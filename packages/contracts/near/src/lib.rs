use near_sdk::json_types::{U128, U64};
use near_sdk::{
    env, near, require,
    serde::{Deserialize, Serialize},
    serde_json,
    store::LookupMap,
    AccountId, Gas, NearToken, PanicOnDefault, Promise, PromiseOrValue,
};

const MIN_LIFETIME_NS: u64 = 60 * 60 * 1_000_000_000;
const MAX_LIFETIME_NS: u64 = 90 * 24 * 60 * 60 * 1_000_000_000;
const MAX_SECRET_BYTES: usize = 128;
const MAX_SEALED_NOTE_BYTES: usize = 1024;
const FT_TRANSFER_GAS: Gas = Gas::from_tgas(10);
const CALLBACK_GAS: Gas = Gas::from_tgas(8);

#[derive(
    Clone,
    Copy,
    Debug,
    Deserialize,
    PartialEq,
    Serialize,
    near_sdk::borsh::BorshDeserialize,
    near_sdk::borsh::BorshSerialize,
)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
pub enum GiftStatus {
    Open,
    Claiming,
    Claimed,
    Refunding,
    Refunded,
}

#[derive(
    Clone,
    Debug,
    Deserialize,
    PartialEq,
    Serialize,
    near_sdk::borsh::BorshDeserialize,
    near_sdk::borsh::BorshSerialize,
)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
pub struct Gift {
    pub id: U64,
    pub sender_id: AccountId,
    pub token_id: AccountId,
    pub amount: U128,
    pub secret_hash: String,
    pub sealed_note: Option<String>,
    pub expires_at_ns: U64,
    pub status: GiftStatus,
    pub recipient_id: Option<AccountId>,
}

#[derive(Deserialize)]
#[serde(crate = "near_sdk::serde")]
struct GiftTerms {
    gift_id: U64,
    secret_hash: String,
    expires_at_ns: U64,
    sealed_note: Option<String>,
}

#[derive(Deserialize, Serialize)]
#[serde(crate = "near_sdk::serde")]
struct CallbackArgs {
    gift_id: U64,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct GiftCreatedEvent {
    standard: &'static str,
    version: &'static str,
    event: &'static str,
    data: Vec<GiftCreatedData>,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
struct GiftCreatedData {
    gift_id: String,
    sender_id: AccountId,
    token_id: AccountId,
    amount: String,
    expires_at_ns: String,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct ContractConfig {
    pub owner_id: AccountId,
    pub relayer_id: AccountId,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Santa {
    owner_id: AccountId,
    relayer_id: AccountId,
    next_gift_id: u64,
    allowed_tokens: LookupMap<AccountId, bool>,
    gifts: LookupMap<u64, Gift>,
    used_claim_nonces: LookupMap<String, bool>,
}

#[near]
impl Santa {
    #[init]
    pub fn new(owner_id: AccountId, relayer_id: AccountId, allowed_tokens: Vec<AccountId>) -> Self {
        require!(
            !allowed_tokens.is_empty(),
            "At least one NEP-141 token must be allowlisted"
        );
        let mut allowed = LookupMap::new(b"a");
        for token_id in allowed_tokens {
            allowed.insert(token_id, true);
        }
        Self {
            owner_id,
            relayer_id,
            next_gift_id: 1,
            allowed_tokens: allowed,
            gifts: LookupMap::new(b"g"),
            used_claim_nonces: LookupMap::new(b"n"),
        }
    }

    pub fn set_token_allowed(&mut self, token_id: AccountId, allowed: bool) {
        self.assert_owner();
        self.allowed_tokens.insert(token_id, allowed);
    }

    pub fn set_relayer(&mut self, relayer_id: AccountId) {
        self.assert_owner();
        self.relayer_id = relayer_id;
    }

    pub fn is_token_allowed(&self, token_id: AccountId) -> bool {
        self.allowed_tokens.get(&token_id).copied().unwrap_or(false)
    }

    pub fn get_gift(&self, gift_id: U64) -> Option<Gift> {
        self.gifts.get(&gift_id.0).cloned()
    }

    pub fn get_next_gift_id(&self) -> U64 {
        U64(self.next_gift_id)
    }

    pub fn is_claim_nonce_used(&self, nonce: String) -> bool {
        self.used_claim_nonces.get(&nonce).copied().unwrap_or(false)
    }

    pub fn get_config(&self) -> ContractConfig {
        ContractConfig {
            owner_id: self.owner_id.clone(),
            relayer_id: self.relayer_id.clone(),
        }
    }

    #[payable]
    pub fn claim_gift(
        &mut self,
        gift_id: U64,
        secret: String,
        recipient_id: AccountId,
        nonce: String,
    ) -> Promise {
        require!(
            env::attached_deposit() == NearToken::from_yoctonear(1),
            "Claim must attach exactly one yoctoNEAR for the FT transfer"
        );
        require!(
            env::predecessor_account_id() == self.relayer_id,
            "Only the configured sponsored-claim relayer may submit claims"
        );
        require!(
            !secret.is_empty() && secret.len() <= MAX_SECRET_BYTES,
            "Invalid claim secret"
        );
        require!(
            valid_hash(&nonce) && nonce == nonce.to_ascii_lowercase(),
            "Invalid claim nonce"
        );
        require!(
            !self.used_claim_nonces.get(&nonce).copied().unwrap_or(false),
            "Claim authorization was already used"
        );
        let mut gift = self.gift_or_panic(gift_id.0);
        require!(gift.status == GiftStatus::Open, "Gift is not open");
        require!(
            env::block_timestamp() < gift.expires_at_ns.0,
            "Gift has expired"
        );
        require!(
            hex(&env::sha256(secret.as_bytes())) == gift.secret_hash,
            "Invalid claim secret"
        );

        gift.status = GiftStatus::Claiming;
        gift.recipient_id = Some(recipient_id.clone());
        self.used_claim_nonces.insert(nonce, true);
        self.gifts.insert(gift_id.0, gift.clone());

        Promise::new(gift.token_id.clone())
            .function_call(
                "ft_transfer".to_string(),
                serde_json::to_vec(&serde_json::json!({
                    "receiver_id": recipient_id,
                    "amount": gift.amount.0.to_string(),
                    "memo": format!("Santa gift {}", gift_id.0),
                }))
                .expect("Serialize FT transfer arguments"),
                NearToken::from_yoctonear(1),
                FT_TRANSFER_GAS,
            )
            .then(
                Promise::new(env::current_account_id()).function_call(
                    "resolve_claim".to_string(),
                    serde_json::to_vec(&CallbackArgs { gift_id })
                        .expect("Serialize claim callback arguments"),
                    NearToken::from_yoctonear(0),
                    CALLBACK_GAS,
                ),
            )
    }

    #[payable]
    pub fn refund_gift(&mut self, gift_id: U64) -> Promise {
        require!(
            env::attached_deposit() == NearToken::from_yoctonear(1),
            "Refund must attach exactly one yoctoNEAR for the FT transfer"
        );
        let mut gift = self.gift_or_panic(gift_id.0);
        require!(
            env::predecessor_account_id() == gift.sender_id,
            "Only the sender may refund this gift"
        );
        require!(gift.status == GiftStatus::Open, "Gift is not open");
        require!(
            env::block_timestamp() >= gift.expires_at_ns.0,
            "Gift has not expired"
        );

        gift.status = GiftStatus::Refunding;
        self.gifts.insert(gift_id.0, gift.clone());

        Promise::new(gift.token_id.clone())
            .function_call(
                "ft_transfer".to_string(),
                serde_json::to_vec(&serde_json::json!({
                    "receiver_id": gift.sender_id,
                    "amount": gift.amount.0.to_string(),
                    "memo": format!("Santa refund {}", gift_id.0),
                }))
                .expect("Serialize FT transfer arguments"),
                NearToken::from_yoctonear(1),
                FT_TRANSFER_GAS,
            )
            .then(
                Promise::new(env::current_account_id()).function_call(
                    "resolve_refund".to_string(),
                    serde_json::to_vec(&CallbackArgs { gift_id })
                        .expect("Serialize refund callback arguments"),
                    NearToken::from_yoctonear(0),
                    CALLBACK_GAS,
                ),
            )
    }

    #[private]
    pub fn resolve_claim(&mut self, gift_id: U64) -> bool {
        let Some(mut gift) = self.gifts.get(&gift_id.0).cloned() else {
            return false;
        };
        if gift.status != GiftStatus::Claiming {
            return false;
        }
        if env::promise_result_checked(0, 64).is_ok() {
            gift.status = GiftStatus::Claimed;
            self.gifts.insert(gift_id.0, gift);
            true
        } else {
            gift.status = GiftStatus::Open;
            gift.recipient_id = None;
            self.gifts.insert(gift_id.0, gift);
            false
        }
    }

    #[private]
    pub fn resolve_refund(&mut self, gift_id: U64) -> bool {
        let Some(mut gift) = self.gifts.get(&gift_id.0).cloned() else {
            return false;
        };
        if gift.status != GiftStatus::Refunding {
            return false;
        }
        if env::promise_result_checked(0, 64).is_ok() {
            gift.status = GiftStatus::Refunded;
            self.gifts.insert(gift_id.0, gift);
            true
        } else {
            gift.status = GiftStatus::Open;
            self.gifts.insert(gift_id.0, gift);
            false
        }
    }

    #[payable]
    pub fn ft_on_transfer(
        &mut self,
        sender_id: AccountId,
        amount: U128,
        msg: String,
    ) -> PromiseOrValue<U128> {
        let token_id = env::predecessor_account_id();
        if !self.is_token_allowed(token_id.clone()) || amount.0 == 0 {
            return PromiseOrValue::Value(amount);
        }

        let Ok(terms) = serde_json::from_str::<GiftTerms>(&msg) else {
            return PromiseOrValue::Value(amount);
        };
        let now = env::block_timestamp();
        if terms.gift_id.0 != self.next_gift_id {
            return PromiseOrValue::Value(amount);
        }
        let expires_at_ns = terms.expires_at_ns.0;
        if !valid_hash(&terms.secret_hash)
            || terms.secret_hash != terms.secret_hash.to_ascii_lowercase()
            || terms.secret_hash.len() != 66
            || terms.secret_hash.as_bytes().len() != 66
            || expires_at_ns < now.saturating_add(MIN_LIFETIME_NS)
            || expires_at_ns > now.saturating_add(MAX_LIFETIME_NS)
            || terms
                .sealed_note
                .as_ref()
                .is_some_and(|note| note.len() > MAX_SEALED_NOTE_BYTES)
        {
            return PromiseOrValue::Value(amount);
        }

        let id = self.next_gift_id;
        self.next_gift_id = self.next_gift_id.checked_add(1).expect("Gift id overflow");
        self.gifts.insert(
            id,
            Gift {
                id: U64(id),
                sender_id,
                token_id,
                amount,
                secret_hash: terms.secret_hash,
                sealed_note: terms.sealed_note,
                expires_at_ns: U64(expires_at_ns),
                status: GiftStatus::Open,
                recipient_id: None,
            },
        );
        env::log_str(
            &serde_json::to_string(&GiftCreatedEvent {
                standard: "santa",
                version: "1.0.0",
                event: "gift_created",
                data: vec![GiftCreatedData {
                    gift_id: id.to_string(),
                    sender_id: self
                        .gifts
                        .get(&id)
                        .expect("Gift was just inserted")
                        .sender_id
                        .clone(),
                    token_id: self
                        .gifts
                        .get(&id)
                        .expect("Gift was just inserted")
                        .token_id
                        .clone(),
                    amount: amount.0.to_string(),
                    expires_at_ns: expires_at_ns.to_string(),
                }],
            })
            .map(|json| format!("EVENT_JSON:{json}"))
            .unwrap_or_else(|_| env::panic_str("Could not serialize gift event")),
        );
        PromiseOrValue::Value(U128(0))
    }
}

impl Santa {
    fn assert_owner(&self) {
        require!(
            env::predecessor_account_id() == self.owner_id,
            "Only the owner may change contract configuration"
        );
    }

    fn gift_or_panic(&self, gift_id: u64) -> Gift {
        self.gifts
            .get(&gift_id)
            .cloned()
            .unwrap_or_else(|| env::panic_str("Gift not found"))
    }
}

fn valid_hash(value: &str) -> bool {
    value.starts_with("0x")
        && value.len() == 66
        && value[2..].bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn hex(bytes: &[u8]) -> String {
    const DIGITS: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2 + 2);
    output.push_str("0x");
    for byte in bytes {
        output.push(DIGITS[(byte >> 4) as usize] as char);
        output.push(DIGITS[(byte & 0x0f) as usize] as char);
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    fn account(value: &str) -> AccountId {
        value.parse().expect("valid account id")
    }

    fn contract() -> Santa {
        Santa::new(
            account("owner.testnet"),
            account("relayer.testnet"),
            vec![account("token.testnet")],
        )
    }

    fn set_context(predecessor: &str, timestamp: u64, attached_deposit: u128) {
        let mut context = VMContextBuilder::new();
        context
            .current_account_id(account("santa.testnet"))
            .predecessor_account_id(account(predecessor))
            .block_timestamp(timestamp)
            .attached_deposit(NearToken::from_yoctonear(attached_deposit));
        testing_env!(context.build());
    }

    fn funded_gift() -> Santa {
        set_context("token.testnet", 0, 0);
        let mut santa = contract();
        let terms = serde_json::json!({
            "gift_id": "1",
            "secret_hash": hex(&env::sha256(b"secret")),
            "expires_at_ns": MIN_LIFETIME_NS.to_string(),
        });
        let result = santa.ft_on_transfer(account("sender.testnet"), U128(25), terms.to_string());
        assert!(matches!(result, PromiseOrValue::Value(U128(0))));
        santa
    }

    fn callback_context(result: near_sdk::PromiseResult) {
        let mut context = VMContextBuilder::new();
        context
            .current_account_id(account("santa.testnet"))
            .predecessor_account_id(account("santa.testnet"));
        testing_env!(
            context.build(),
            near_sdk::test_vm_config(),
            near_sdk::RuntimeFeesConfig::test(),
            Default::default(),
            vec![result]
        );
    }

    #[test]
    fn claims_finalize_only_after_successful_transfer_and_cannot_be_claimed_twice() {
        let mut santa = funded_gift();
        set_context("relayer.testnet", 0, 1);
        let _ = santa.claim_gift(
            U64(1),
            "secret".into(),
            account("recipient.testnet"),
            format!("0x{}", "ab".repeat(32)),
        );
        assert_eq!(santa.get_gift(U64(1)).unwrap().status, GiftStatus::Claiming);
        callback_context(near_sdk::PromiseResult::Successful(vec![]));
        assert!(santa.resolve_claim(U64(1)));
        assert!(!santa.resolve_claim(U64(1)));
        let gift = santa.get_gift(U64(1)).unwrap();
        assert_eq!(gift.status, GiftStatus::Claimed);
        assert_eq!(gift.recipient_id, Some(account("recipient.testnet")));
        set_context("relayer.testnet", 0, 1);
        assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let _ = santa.claim_gift(
                U64(1),
                "secret".into(),
                account("recipient.testnet"),
                format!("0x{}", "cd".repeat(32)),
            );
        }))
        .is_err());
    }

    #[test]
    fn failed_claim_reopens_gift_but_requires_a_fresh_nonce() {
        let mut santa = funded_gift();
        let nonce = format!("0x{}", "ab".repeat(32));
        set_context("relayer.testnet", 0, 1);
        let _ = santa.claim_gift(
            U64(1),
            "secret".into(),
            account("recipient.testnet"),
            nonce.clone(),
        );
        callback_context(near_sdk::PromiseResult::Failed);
        assert!(!santa.resolve_claim(U64(1)));
        let gift = santa.get_gift(U64(1)).unwrap();
        assert_eq!(gift.status, GiftStatus::Open);
        assert_eq!(gift.recipient_id, None);
        set_context("relayer.testnet", 0, 1);
        assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let _ = santa.claim_gift(U64(1), "secret".into(), account("recipient.testnet"), nonce);
        }))
        .is_err());
        let _ = santa.claim_gift(
            U64(1),
            "secret".into(),
            account("recipient.testnet"),
            format!("0x{}", "cd".repeat(32)),
        );
        assert_eq!(santa.get_gift(U64(1)).unwrap().status, GiftStatus::Claiming);
    }

    #[test]
    fn rejects_unauthorized_bad_secret_and_expired_claims() {
        let mut santa = funded_gift();
        for (caller, time, secret) in [
            ("stranger.testnet", 0, "secret"),
            ("relayer.testnet", 0, "wrong"),
            ("relayer.testnet", MIN_LIFETIME_NS, "secret"),
        ] {
            set_context(caller, time, 1);
            assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                let _ = santa.claim_gift(
                    U64(1),
                    secret.into(),
                    account("recipient.testnet"),
                    format!("0x{}", "ab".repeat(32)),
                );
            }))
            .is_err());
            assert_eq!(santa.get_gift(U64(1)).unwrap().status, GiftStatus::Open);
        }
    }

    #[test]
    fn sender_refunds_only_after_expiry_and_failed_transfers_can_be_retried() {
        let mut santa = funded_gift();
        for (caller, time) in [
            ("sender.testnet", MIN_LIFETIME_NS - 1),
            ("stranger.testnet", MIN_LIFETIME_NS),
        ] {
            set_context(caller, time, 1);
            assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                let _ = santa.refund_gift(U64(1));
            }))
            .is_err());
        }
        set_context("sender.testnet", MIN_LIFETIME_NS, 1);
        let _ = santa.refund_gift(U64(1));
        assert_eq!(
            santa.get_gift(U64(1)).unwrap().status,
            GiftStatus::Refunding
        );
        callback_context(near_sdk::PromiseResult::Failed);
        assert!(!santa.resolve_refund(U64(1)));
        assert_eq!(santa.get_gift(U64(1)).unwrap().status, GiftStatus::Open);
        set_context("sender.testnet", MIN_LIFETIME_NS, 1);
        let _ = santa.refund_gift(U64(1));
        callback_context(near_sdk::PromiseResult::Successful(vec![]));
        assert!(santa.resolve_refund(U64(1)));
        assert!(!santa.resolve_refund(U64(1)));
        assert_eq!(santa.get_gift(U64(1)).unwrap().status, GiftStatus::Refunded);
    }

    #[test]
    fn stale_id_and_invalid_deposits_are_returned_without_overwriting_a_gift() {
        let mut santa = funded_gift();
        set_context("token.testnet", 0, 0);
        let original = santa.get_gift(U64(1)).unwrap();
        for (id, expiry, note) in [
            (1, MIN_LIFETIME_NS, None),
            (2, MIN_LIFETIME_NS - 1, None),
            (2, MAX_LIFETIME_NS + 1, None),
            (2, MIN_LIFETIME_NS, Some("x".repeat(1025))),
        ] {
            let terms = serde_json::json!({ "gift_id": id.to_string(),
                "secret_hash": original.secret_hash, "expires_at_ns": expiry.to_string(), "sealed_note": note });
            assert!(matches!(
                santa.ft_on_transfer(account("sender.testnet"), U128(10), terms.to_string()),
                PromiseOrValue::Value(U128(10))
            ));
            assert_eq!(santa.get_gift(U64(1)).unwrap(), original);
            assert!(santa.get_gift(U64(2)).is_none());
            assert_eq!(santa.get_next_gift_id(), U64(2));
        }
    }

    #[test]
    fn accepts_allowlisted_ft_and_returns_full_amount_for_rejected_deposits() {
        let now = 1_000_000_000_000;
        set_context("token.testnet", now, 0);
        let mut santa = contract();
        let secret = "private-gift-link-secret";
        let hash = hex(&env::sha256(secret.as_bytes()));
        let terms = serde_json::json!({
            "gift_id": "1",
            "secret_hash": hash,
            "expires_at_ns": (now + MIN_LIFETIME_NS).to_string(),
            "sealed_note": null,
        });

        let PromiseOrValue::Value(unused) =
            santa.ft_on_transfer(account("sender.testnet"), U128(25), terms.to_string())
        else {
            panic!("FT deposit callback should not schedule a promise");
        };
        assert_eq!(unused, U128(0));
        let gift = santa.get_gift(U64(1)).expect("gift stored");
        assert_eq!(gift.amount, U128(25));
        assert_eq!(gift.sender_id, account("sender.testnet"));
        assert_eq!(gift.status, GiftStatus::Open);

        set_context("unknown.testnet", now, 0);
        let PromiseOrValue::Value(unused) =
            santa.ft_on_transfer(account("sender.testnet"), U128(9), terms.to_string())
        else {
            panic!("invalid FT deposit should be returned");
        };
        assert_eq!(unused, U128(9));
    }

    #[test]
    fn rejects_invalid_secret_hash_and_expiry_without_custody() {
        let now = 1_000_000_000_000;
        set_context("token.testnet", now, 0);
        let mut santa = contract();
        let invalid = serde_json::json!({
            "gift_id": "1",
            "secret_hash": "0xinvalid",
            "expires_at_ns": (now + MIN_LIFETIME_NS).to_string(),
            "sealed_note": null,
        });
        let PromiseOrValue::Value(unused) =
            santa.ft_on_transfer(account("sender.testnet"), U128(1), invalid.to_string())
        else {
            panic!("invalid FT deposit should be returned");
        };
        assert_eq!(unused, U128(1));
        assert!(santa.get_gift(U64(1)).is_none());
    }

    #[test]
    fn claim_nonce_cannot_be_reused_for_another_gift() {
        let now = 1_000_000_000_000;
        let secret = "private-gift-link-secret";
        let secret_hash = hex(&env::sha256(secret.as_bytes()));
        set_context("token.testnet", now, 0);
        let mut santa = contract();
        for id in ["1", "2"] {
            let terms = serde_json::json!({
                "gift_id": id,
                "secret_hash": secret_hash,
                "expires_at_ns": (now + MIN_LIFETIME_NS).to_string(),
                "sealed_note": null,
            });
            let PromiseOrValue::Value(unused) =
                santa.ft_on_transfer(account("sender.testnet"), U128(1), terms.to_string())
            else {
                panic!("FT deposit callback should not schedule a promise");
            };
            assert_eq!(unused, U128(0));
        }

        let nonce = format!("0x{}", "ab".repeat(32));
        set_context("relayer.testnet", now, 1);
        let _claim = santa.claim_gift(
            U64(1),
            secret.to_string(),
            account("recipient.testnet"),
            nonce.clone(),
        );
        assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let _replay = santa.claim_gift(
                U64(2),
                secret.to_string(),
                account("recipient.testnet"),
                nonce,
            );
        }))
        .is_err());
    }

    #[test]
    fn only_owner_can_change_token_allowlist() {
        let mut santa = contract();
        set_context("stranger.testnet", 0, 0);
        assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            santa.set_token_allowed(account("other-token.testnet"), true);
        }))
        .is_err());
        set_context("owner.testnet", 0, 0);
        santa.set_token_allowed(account("other-token.testnet"), true);
        assert!(santa.is_token_allowed(account("other-token.testnet")));
    }
}
