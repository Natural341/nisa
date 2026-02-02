// Admin şifresini hashle
const bcrypt = require('bcryptjs');

const password = 'JHm1Lrkc28yKEDzhq#v7iMRuFYN?Xd5otnBl4f@.';

bcrypt.hash(password, 10, (err, hash) => {
    if (err) throw err;
    console.log('Hashed Password:');
    console.log(hash);
    console.log('\nSQL Query:');
    console.log(`INSERT INTO admin_users (id, username, password_hash, display_name, created_at) VALUES (UUID(), 'admin', '${hash}', 'System Owner', NOW());`);
});
