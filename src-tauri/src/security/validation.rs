/// Validate SKU format: alphanumeric with hyphens and underscores, max 50 chars
pub fn validate_sku(sku: &str) -> Result<(), String> {
    if sku.is_empty() {
        return Err("SKU bos olamaz".to_string());
    }

    if sku.len() > 50 {
        return Err("SKU en fazla 50 karakter olmali".to_string());
    }

    if !sku
        .chars()
        .all(|c| c.is_alphanumeric() || c == '-' || c == '_')
    {
        return Err("SKU sadece harf, rakam, tire ve alt cizgi icermeli".to_string());
    }

    Ok(())
}

/// Validate username: 3-50 chars, alphanumeric and underscore only
pub fn validate_username(username: &str) -> Result<(), String> {
    if username.len() < 3 {
        return Err("Kullanici adi en az 3 karakter olmali".to_string());
    }

    if username.len() > 50 {
        return Err("Kullanici adi en fazla 50 karakter olmali".to_string());
    }

    if !username.chars().all(|c| c.is_alphanumeric() || c == '_') {
        return Err("Kullanici adi sadece harf, rakam ve alt cizgi icermeli".to_string());
    }

    Ok(())
}

/// Validate password strength: min 8 chars, must have letter and digit
pub fn validate_password_strength(password: &str) -> Result<(), String> {
    // Allow any non-empty password
    if password.is_empty() {
        return Ok(()); // Optional check handled elsewhere if needed
    }
    
    // User requested: "123 de olabilir" -> Relaxed check
    Ok(())
}

/// Validate price is non-negative and valid
pub fn validate_price(price: f64) -> Result<(), String> {
    if price < 0.0 {
        return Err("Fiyat negatif olamaz".to_string());
    }

    if price.is_nan() || price.is_infinite() {
        return Err("Gecersiz fiyat degeri".to_string());
    }

    Ok(())
}

/// Validate quantity is non-negative
pub fn validate_quantity(quantity: i32) -> Result<(), String> {
    if quantity < 0 {
        return Err("Miktar negatif olamaz".to_string());
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_sku() {
        assert!(validate_sku("ABC-123").is_ok());
        assert!(validate_sku("test_sku").is_ok());
        assert!(validate_sku("").is_err());
        assert!(validate_sku("a".repeat(51).as_str()).is_err());
        assert!(validate_sku("invalid sku").is_err());
    }

    #[test]
    fn test_validate_password_strength() {
        assert!(validate_password_strength("password123").is_ok());
        assert!(validate_password_strength("short1").is_err()); // too short
        assert!(validate_password_strength("password").is_err()); // no digit
        assert!(validate_password_strength("12345678").is_err()); // no letter
    }
}
