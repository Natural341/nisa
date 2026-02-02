use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Veritabani hatasi: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("Baglanti havuzu hatasi: {0}")]
    Pool(#[from] r2d2::Error),

    #[error("Bulunamadi: {0}")]
    NotFound(String),

    #[error("Dogrulama hatasi: {0}")]
    Validation(String),

    #[error("Kimlik dogrulama hatasi: {0}")]
    Auth(String),

    #[error("Yetersiz stok - {sku}: mevcut {available}, istenen {requested}")]
    InsufficientStock {
        sku: String,
        available: i32,
        requested: i32,
    },

    #[error("Kullanici kilitli: {minutes} dakika sonra tekrar deneyin")]
    UserLocked { minutes: i64 },

    #[error("IO hatasi: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON hatasi: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Sifre hashleme hatasi: {0}")]
    PasswordHash(String),

    #[error("Dahili hata: {0}")]
    Internal(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl From<AppError> for String {
    fn from(err: AppError) -> String {
        err.to_string()
    }
}

impl From<anyhow::Error> for AppError {
    fn from(err: anyhow::Error) -> Self {
        AppError::Internal(err.to_string())
    }
}

impl From<argon2::password_hash::Error> for AppError {
    fn from(err: argon2::password_hash::Error) -> Self {
        AppError::PasswordHash(err.to_string())
    }
}
