const createBitcoinBatchTransaction = require("./bitcoin");

async function main() {
  console.log("Starting Bitcoin Batch Transaction");
  await createBitcoinBatchTransaction();
}

main();
