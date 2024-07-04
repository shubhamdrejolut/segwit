const bitcoin = require("bitcoinjs-lib");
const request = require("request");
const config = require("./config");

const { apiUrl, address } = config;

async function createBitcoinBatchTransaction() {
  // Use your predefined private key
  const privateKeyWIF = "cRvfszrcZugcVB7Yen6buyaxpq3bhdLrjxabMbVwhbtGvtSFLB4H";
  const keyPair = bitcoin.ECPair.fromWIF(
    privateKeyWIF,
    bitcoin.networks.testnet
  );
  const pubkey = keyPair.publicKey;

  const { address: generatedAddress } = bitcoin.payments.p2wpkh({
    pubkey: pubkey,
    network: bitcoin.networks.testnet,
  });

  console.log("Your Bitcoin Testnet SegWit address:", generatedAddress);
  console.log("Your Public Key:", pubkey.toString("hex"));
  console.log("Your Bitcoin Testnet private key (WIF):", keyPair.toWIF());

  const utxosUrl = `${apiUrl}/addrs/${generatedAddress}?unspentOnly=true`;
  console.log("Fetching UTXOs from:", utxosUrl);

  request(utxosUrl, { json: true }, (err, res, body) => {
    if (err) {
      return console.error("Error fetching UTXOs:", err);
    }

    if (!body || (!body.txrefs && !body.unconfirmed_txrefs)) {
      return console.error("No UTXOs found or unexpected response:", body);
    }

    const utxos = (body.txrefs || [])
      .concat(body.unconfirmed_txrefs || [])
      .filter((utxo) => utxo.confirmations > 0)
      .map((utxo) => ({
        txid: utxo.tx_hash,
        vout: utxo.tx_output_n,
        value: utxo.value,
      }));

    if (utxos.length === 0) {
      return console.error("No confirmed UTXOs found.");
    }

    const totalBalance = utxos.reduce((sum, utxo) => sum + utxo.value, 0);
    console.log(`Total balance: ${totalBalance} satoshis`);

    const fee = 10000; // Set a fee of 1000 satoshis
    const amountToSendEach = Math.floor((totalBalance - fee) / 100);
    console.log("Amount to send each recipient:", amountToSendEach);
    // process.exit();

    // Generate 100 recipient addresses
    const outputs = [];
    for (let i = 0; i < 100; i++) {
      const keyPair1 = bitcoin.ECPair.makeRandom({
        network: bitcoin.networks.testnet,
      });
      const { address } = bitcoin.payments.p2wpkh({
        pubkey: keyPair1.publicKey,
        network: bitcoin.networks.testnet,
      });
      outputs.push({ address: address, value: amountToSendEach });
      console.log(`Generated address ${i + 1}: ${address}`);
    }

    const psbt = new bitcoin.Psbt({ network: bitcoin.networks.testnet });
    utxos.forEach((utxo) => {
      psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        witnessUtxo: {
          script: bitcoin.payments.p2wpkh({
            pubkey: pubkey,
            network: bitcoin.networks.testnet,
          }).output,
          value: utxo.value,
        },
      });
    });

    outputs.forEach((output) => {
      psbt.addOutput(output);
    });

    psbt.signAllInputs(keyPair);
    psbt.finalizeAllInputs();

    const txHex = psbt.extractTransaction().toHex();
    console.log("Transaction Hex:", txHex);

    const broadcastUrl = `${apiUrl}/txs/push`;
    request.post(broadcastUrl, { json: { tx: txHex } }, (err, res, body) => {
      if (err) return console.error("Error broadcasting transaction");
      console.log("Transaction broadcasted:", body);
    });
  });
}

module.exports = createBitcoinBatchTransaction;

// const keyPair1 = bitcoin.ECPair.makeRandom({
//   network: bitcoin.networks.testnet,
// });
// const { address } = bitcoin.payments.p2wpkh({
//   pubkey: keyPair1.publicKey,
//   network: bitcoin.networks.testnet,
// });

// console.log("Your Bitcoin Testnet SegWit address:", address);
// console.log(
//   "Your Bitcoin Testnet SegWit public key:",
//   keyPair1.publicKey.toString("hex")
// );
// console.log("Your Bitcoin Testnet private key (WIF):", keyPair1.toWIF());
// process.exit();
