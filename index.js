const KeyVault = require('azure-keyvault');
const msRestAzure = require('ms-rest-azure');
const express = require('express');

const vaultName = /*Replace this with your Key Vault Name*/;
const keyVaultResourceURL = 'https://vault.azure.net';
const vaultUri = `https://${vaultName}.vault.azure.net/`;
var keyVaultClient;
var secrets = {};

function getSecretName(id) {
    var value = id.replace(`${vaultUri}secrets/`, '');
    if (value.indexOf('/') > 0) {
        return value.substring(0, value.indexOf('/'));
    } else {
        return value;
    }
}

async function keyVaultInitialization() {
    console.log('Key Vault Initialization Started');
    let credentailPromise;
    if (process.env['MSI_ENDPOINT']) {
        console.log('Azure Token Service : MSI');
        credentailPromise = msRestAzure.loginWithAppServiceMSI({ resource: keyVaultResourceURL });
    } else {
        console.log('Azure Token Service : Interactive Login');
        // Copy the code from console and open the https://microsoft.com/devicelogin url in browser and paste it.
        credentailPromise = msRestAzure.interactiveLogin({ resource: keyVaultResourceURL });
    }
    keyVaultClient = new KeyVault.KeyVaultClient(await credentailPromise);
    console.log('Key Vault Client Initialized');
    loadAllSecrets();
}

async function loadAllSecrets() {
    const secretsResponse = await keyVaultClient.getSecrets(vaultUri);
    if (secretsResponse) {
        const secretPromises = [];
        secretsResponse.forEach(secret => {
            const secretName = getSecretName(secret.id);
            secretPromises.push(keyVaultClient.getSecret(vaultUri, secretName, ''));
        });
        const secretValueResponse = await Promise.all(secretPromises);
        if (secretValueResponse) {
            secretValueResponse.forEach(secret => {
                const secretName = getSecretName(secret.id);
                secrets[secretName] = secret.value;
                console.log(`Secret (${secretName}) loaded`);
            });
        }
    }
    startServer();
}

function startServer() {
    const app = express();

    app.get('/', function (req, res) {
        res.json(secrets);
    })

    var port = process.env.PORT || 1337;
    app.listen(port);

    console.log('Server running at http://localhost:%d', port);
}

keyVaultInitialization();