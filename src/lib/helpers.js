const bcrypt = require('bcryptjs');

const helpers = {};

helpers.encryptPassword = async (senha) => {
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(senha, salt);
  return hash;
};

//comparação senhas
helpers.matchPassword = async (senha, savedPassword) => {
  try {
    return await bcrypt.compare(senha, savedPassword);
  } catch (e) {
    console.log(e)
  }
};

module.exports = helpers;
