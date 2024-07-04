const {
  Connection,
  clusterApiUrl,
  Keypair,
  LAMPORTS_PER_SOL,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");

// Replace with your private key array
const PRIVATE_KEY = Uint8Array.from([
  150, 81, 210, 187, 229, 233, 77, 111, 114, 42, 8, 182, 99, 72, 230, 8, 15,
  110, 50, 126, 211, 51, 134, 179, 176, 163, 121, 42, 33, 42, 56, 134, 142, 121,
  193, 1, 172, 11, 240, 117, 151, 88, 167, 132, 209, 198, 142, 253, 46, 165, 90,
  61, 125, 119, 121, 96, 145, 214, 223, 109, 202, 46, 29, 131,
]);

const BATCH_SIZE = 21; // Number of recipients per transaction

async function createSolanaBatchTransaction() {
  // Connect to the Devnet cluster
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  console.log("Connected to the cluster");

  // Create a Keypair from the private key
  const payer = Keypair.fromSecretKey(PRIVATE_KEY);

  // Generate recipient addresses
  const recipients = [];
  for (let i = 0; i < 100; i++) {
    const recipient = Keypair.generate();
    recipients.push(recipient.publicKey);
  }

  // Fetch payer's balance
  const payerBalance = await connection.getBalance(payer.publicKey);
  console.log(`Payer's balance: ${payerBalance / LAMPORTS_PER_SOL} SOL`);

  // Get the recent blockhash
  const { blockhash } = await connection.getRecentBlockhash();

  // Calculate the estimated fee per transaction
  const tempTransaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: recipients[0],
      lamports: 1, // Placeholder amount
    })
  );

  tempTransaction.recentBlockhash = blockhash;
  tempTransaction.feePayer = payer.publicKey;

  const feeCalculator = await connection.getFeeCalculatorForBlockhash(
    blockhash
  );
  const feePerSignature = feeCalculator.value.lamportsPerSignature;
  const estimatedFee =
    feePerSignature * (1 + tempTransaction.signatures.length);

  console.log(`Estimated transaction fee per batch: ${estimatedFee} lamports`);

  // Calculate the amount to send to each recipient
  const totalAvailable =
    payerBalance - estimatedFee * Math.ceil(recipients.length / BATCH_SIZE);
  const amountToSendEach = Math.floor(totalAvailable / recipients.length);
  console.log(
    `Amount to send each recipient: ${amountToSendEach / LAMPORTS_PER_SOL} SOL`
  );

  // Check if the calculated amount is valid
  if (amountToSendEach < 1) {
    console.error(
      "Insufficient balance to cover the transaction fee and transfer amount."
    );
    return;
  }

  //   process.exit();

  // Split recipients into batches and create transactions
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    const transaction = new Transaction();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = payer.publicKey;

    batch.forEach((recipient) => {
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: recipient,
          lamports: amountToSendEach,
        })
      );
    });

    // Sign and send the transaction
    try {
      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [payer]
      );
      console.log(
        `Transaction signature for batch ${i / BATCH_SIZE + 1}: ${signature}`
      );
    } catch (error) {
      console.error(
        `Error sending transaction for batch ${i / BATCH_SIZE + 1}:`,
        error
      );
      if (error.logs) {
        console.log("Transaction logs:", error.logs);
      }
    }
  }
}

createSolanaBatchTransaction();
