use argon2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use rand::rngs::OsRng;

use crate::error::AppError;

/// Hash a password using Argon2id
pub fn hash_password(password: &str) -> Result<String, AppError> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();

    let password_hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| AppError::PasswordHash(e.to_string()))?
        .to_string();

    Ok(password_hash)
}

/// Verify a password against a stored hash
pub fn verify_password(password: &str, hash: &str) -> Result<bool, AppError> {
    // Argon2 hash değilse geçersiz
    if !hash.starts_with("$argon2") {
        return Err(AppError::PasswordHash("Geçersiz hash formatı".to_string()));
    }

    let parsed_hash = PasswordHash::new(hash)
        .map_err(|e| AppError::PasswordHash(format!("Hash parse hatasi: {}", e)))?;

    let argon2 = Argon2::default();

    Ok(argon2
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_and_verify() {
        let password = "test123456";
        let hash = hash_password(password).unwrap();
        assert!(verify_password(password, &hash).unwrap());
        assert!(!verify_password("wrong", &hash).unwrap());
    }

    #[test]
    fn test_invalid_hash_format() {
        // Plain text veya geçersiz format artık hata döndürmeli
        assert!(verify_password("admin123", "admin123_hashed").is_err());
        assert!(verify_password("test", "plaintext").is_err());
    }
}
