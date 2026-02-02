const bcrypt = require('bcryptjs');
(async () => {
    const hash = await bcrypt.hash('NisaAdmin2024!', 10);
    console.log('HASH:', hash);
})();
