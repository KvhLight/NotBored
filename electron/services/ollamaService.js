const { exec } = require('child_process');

async function getInstalledModels() {
  const response = await fetch(
    'http://127.0.0.1:11434/api/tags'
  );

  const data = await response.json();

  return data.models.map(model => model.name);
}

module.exports = {
  getInstalledModels,
};