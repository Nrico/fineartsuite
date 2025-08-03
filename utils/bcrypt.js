let bcrypt;
try {
  bcrypt = require('bcrypt');
} catch (e) {
  const crypto = require('crypto');
  bcrypt = {
    hash(password, saltRounds, cb) {
      crypto.randomBytes(16, (err, salt) => {
        if (err) return cb(err);
        crypto.scrypt(password, salt, 64, (err2, derivedKey) => {
          if (err2) return cb(err2);
          cb(null, salt.toString('hex') + ':' + derivedKey.toString('hex'));
        });
      });
    },
    hashSync(password, saltRounds) {
      const salt = crypto.randomBytes(16);
      const derivedKey = crypto.scryptSync(password, salt, 64);
      return salt.toString('hex') + ':' + derivedKey.toString('hex');
    },
    compare(password, hash, cb) {
      const [saltHex, keyHex] = hash.split(':');
      const salt = Buffer.from(saltHex, 'hex');
      crypto.scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) return cb(err);
        const storedKey = Buffer.from(keyHex, 'hex');
        cb(null, crypto.timingSafeEqual(storedKey, derivedKey));
      });
    },
    compareSync(password, hash) {
      const [saltHex, keyHex] = hash.split(':');
      const salt = Buffer.from(saltHex, 'hex');
      const derivedKey = crypto.scryptSync(password, salt, 64);
      const storedKey = Buffer.from(keyHex, 'hex');
      return crypto.timingSafeEqual(storedKey, derivedKey);
    }
  };
}
module.exports = bcrypt;
