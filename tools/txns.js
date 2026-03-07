import { z } from "zod";
import algosdk from "algosdk";
import { CONTRACT, abi, arc200, swap200, arc72 } from "ulujs";
import { swap as swapUtil, Info as swapInfo } from "ulujs/utils/swap.js";
import { getAlgodClient, getIndexerClient } from "../lib/clients.js";
import { SUPPORTED_NETWORKS } from "../config/networks.js";

function makeArc200(network, contractId, sender) {
  const algod = getAlgodClient(network);
  const indexer = getIndexerClient(network);
  return new arc200(contractId, algod, indexer, {
    acc: { addr: sender },
  });
}

function makeSwap(network, poolId, sender) {
  const algod = getAlgodClient(network);
  const indexer = getIndexerClient(network);
  return new swap200(poolId, algod, indexer, {
    acc: { addr: sender },
  });
}

function makeArc72(network, contractId, sender) {
  const algod = getAlgodClient(network);
  const indexer = getIndexerClient(network);
  return new arc72(contractId, algod, indexer, {
    acc: { addr: sender },
  });
}

function stringify(obj) {
  return JSON.stringify(obj, (_, v) =>
    typeof v === "bigint" ? v.toString() : v
  );
}

function success(data) {
  return { content: [{ type: "text", text: stringify(data) }] };
}

function failure(error) {
  return {
    content: [{ type: "text", text: stringify({ error: String(error) }) }],
    isError: true,
  };
}

const networkSchema = z
  .string()
  .describe(`Network identifier (${SUPPORTED_NETWORKS.join(", ")})`);

export function registerTxnTools(server) {
  server.tool(
    "arc200_transfer_txn",
    "Builds unsigned ARC-200 token transfer transactions. Returns base64-encoded transaction group (string[]) for wallet signing. Simulation must pass (sender needs sufficient balance).",
    {
      network: networkSchema,
      contractId: z.number().describe("ARC-200 token contract ID"),
      sender: z.string().describe("Sender wallet address"),
      to: z.string().describe("Recipient wallet address"),
      amount: z
        .string()
        .describe("Transfer amount in base units (as string for large values)"),
    },
    async ({ network, contractId, sender, to, amount }) => {
      try {
        const contract = makeArc200(network, contractId, sender);
        const result = await contract.arc200_transfer(to, BigInt(amount));
        if (!result.success) {
          return failure(
            result.error ||
              "Simulation failed — sender may have insufficient balance"
          );
        }
        return success({
          action: "arc200_transfer",
          contractId,
          sender,
          to,
          amount,
          txns: result.txns,
        });
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "arc200_approve_txn",
    "Builds unsigned ARC-200 approval transactions to authorize a spender. Returns base64-encoded transaction group (string[]) for wallet signing.",
    {
      network: networkSchema,
      contractId: z.number().describe("ARC-200 token contract ID"),
      sender: z.string().describe("Token owner wallet address"),
      spender: z.string().describe("Address to authorize for spending"),
      amount: z
        .string()
        .describe("Allowance amount in base units (as string for large values)"),
    },
    async ({ network, contractId, sender, spender, amount }) => {
      try {
        const contract = makeArc200(network, contractId, sender);
        const result = await contract.arc200_approve(spender, BigInt(amount));
        if (!result.success) {
          return failure(result.error || "Failed to build approve transactions");
        }
        return success({
          action: "arc200_approve",
          contractId,
          sender,
          spender,
          amount,
          txns: result.txns,
        });
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "humble_swap_txn",
    "Builds unsigned HumbleSwap pool swap transactions. Handles native VOI wrapping, approvals, and withdrawal automatically. Returns base64-encoded transaction group (string[]) for wallet signing. Use tokenIn=0 for native VOI on voi-mainnet.",
    {
      network: networkSchema,
      poolId: z.number().describe("HumbleSwap pool application ID"),
      sender: z.string().describe("Swapper wallet address"),
      tokenIn: z
        .number()
        .describe(
          "Contract ID of the token being swapped in (use 0 for native VOI on voi-mainnet)"
        ),
      tokenOut: z
        .number()
        .describe("Contract ID of the token being received"),
      amountIn: z
        .string()
        .describe(
          "Amount of input token in human-readable units (e.g. '1' for 1 VOI)"
        ),
      slippage: z
        .number()
        .optional()
        .describe("Slippage tolerance as decimal (default 0.01 = 1%)"),
    },
    async ({ network, poolId, sender, tokenIn, tokenOut, amountIn, slippage }) => {
      try {
        const algod = getAlgodClient(network);
        const indexer = getIndexerClient(network);
        const acc = { addr: sender, sk: new Uint8Array(0) };
        const ci = new CONTRACT(
          poolId,
          algod,
          indexer,
          abi.swap,
          acc,
          true,
          false
        );

        const infoR = await swapInfo(ci);
        if (!infoR.success) {
          return failure("Failed to fetch pool info");
        }
        const { tokA, tokB } = infoR.returnValue;

        const VOI_NATIVE_OVERRIDES = { "voi-mainnet": 390001 };
        const resolvedIn =
          tokenIn === 0 && VOI_NATIVE_OVERRIDES[network]
            ? VOI_NATIVE_OVERRIDES[network]
            : tokenIn;
        const resolvedOut =
          tokenOut === 0 && VOI_NATIVE_OVERRIDES[network]
            ? VOI_NATIVE_OVERRIDES[network]
            : tokenOut;

        const isAForB =
          resolvedIn === tokA && resolvedOut === tokB;
        const isBForA =
          resolvedIn === tokB && resolvedOut === tokA;
        if (!isAForB && !isBForA) {
          return failure(
            `Token pair (${tokenIn}, ${tokenOut}) does not match pool tokens (A=${tokA}, B=${tokB})`
          );
        }

        async function fetchTokenMeta(contractId) {
          const acc = { addr: sender, sk: new Uint8Array(0) };
          const ci = new arc200(contractId, algod, indexer, { acc });
          const ntCi = new CONTRACT(
            contractId, algod, indexer, abi.nt200, acc
          );
          const [decR, symR, nameR, withdrawR] = await Promise.all([
            ci.arc200_decimals(),
            ci.arc200_symbol(),
            ci.arc200_name(),
            ntCi.withdraw(1),
          ]);
          const isNt200 =
            withdrawR.success ||
            !withdrawR.error?.includes("match label");
          return {
            decimals: decR.success ? Number(decR.returnValue) : 6,
            symbol: symR.success ? symR.returnValue : String(contractId),
            name: nameR.success ? nameR.returnValue : "",
            isNt200,
          };
        }

        const [metaIn, metaOut] = await Promise.all([
          fetchTokenMeta(resolvedIn),
          fetchTokenMeta(resolvedOut),
        ]);

        const A = {
          tokenId: metaIn.isNt200 ? String(tokenIn) : undefined,
          contractId: resolvedIn,
          symbol: metaIn.symbol,
          decimals: metaIn.decimals,
          amount: amountIn,
        };
        const B = {
          tokenId: metaOut.isNt200 ? String(tokenOut) : undefined,
          contractId: resolvedOut,
          symbol: metaOut.symbol,
          decimals: metaOut.decimals,
        };

        const result = await swapUtil(ci, sender, poolId, A, B, [], {
          debug: false,
          slippage: slippage ?? 0.01,
        });

        if (!result || !result.success) {
          return failure(
            result?.error ||
              "Swap simulation failed — sender may have insufficient balance"
          );
        }
        return success({
          action: "humble_swap",
          poolId,
          sender,
          tokenIn,
          tokenOut,
          amountIn,
          txns: result.txns,
        });
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "arc200_transferFrom_txn",
    "Builds unsigned ARC-200 delegated transfer transactions (spend from an approved allowance). Returns base64-encoded transaction group (string[]) for wallet signing. Requires prior approval from the token owner.",
    {
      network: networkSchema,
      contractId: z.number().describe("ARC-200 token contract ID"),
      sender: z
        .string()
        .describe("Spender wallet address (must have approval from 'from')"),
      from: z.string().describe("Token owner address to transfer from"),
      to: z.string().describe("Recipient wallet address"),
      amount: z
        .string()
        .describe("Transfer amount in base units (as string for large values)"),
    },
    async ({ network, contractId, sender, from, to, amount }) => {
      try {
        const contract = makeArc200(network, contractId, sender);
        const result = await contract.arc200_transferFrom(
          from,
          to,
          BigInt(amount)
        );
        if (!result.success) {
          return failure(
            result.error ||
              "Simulation failed — spender may lack sufficient allowance or owner has insufficient balance"
          );
        }
        return success({
          action: "arc200_transferFrom",
          contractId,
          sender,
          from,
          to,
          amount,
          txns: result.txns,
        });
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "arc72_transferFrom_txn",
    "Builds unsigned ARC-72 NFT transfer transactions. Returns base64-encoded transaction group (string[]) for wallet signing. Sender must be the owner or an approved operator.",
    {
      network: networkSchema,
      contractId: z.number().describe("ARC-72 NFT collection contract ID"),
      sender: z
        .string()
        .describe("Wallet address initiating the transfer (owner or approved)"),
      from: z.string().describe("Current NFT owner address"),
      to: z.string().describe("Recipient wallet address"),
      tokenId: z.string().describe("Token ID within the collection"),
    },
    async ({ network, contractId, sender, from, to, tokenId }) => {
      try {
        const nft = makeArc72(network, contractId, sender);
        const ci = nft.contractInstance;

        const algod = getAlgodClient(network);
        const appAddr = algosdk.getApplicationAddress(BigInt(contractId));
        const accInfo = await algod.accountInformation(appAddr).do();
        const available =
          BigInt(accInfo.amount) - BigInt(accInfo.minBalance);
        const boxCost = 28500;
        if (available < BigInt(boxCost)) {
          ci.setPaymentAmount(
            boxCost - Number(available > 0n ? available : 0n)
          );
        }

        const result = await ci.arc72_transferFrom(
          from,
          to,
          BigInt(tokenId)
        );
        if (!result.success) {
          return failure(
            result.error ||
              "Simulation failed — sender may not own or be approved for this token"
          );
        }
        return success({
          action: "arc72_transferFrom",
          contractId,
          sender,
          from,
          to,
          tokenId,
          txns: result.txns,
        });
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "envoi_purchase_txn",
    "Builds unsigned transactions to register/purchase an enVoi name (e.g. 'myname.voi', 'myname.wallet.voi'). Dynamically discovers the registrar, payment token, and price. For nt200 payment tokens (like enVoi/wVOI), auto-deposits native VOI. For other ARC-200 payment tokens, user must already hold them. Returns base64-encoded transaction group (string[]) for wallet signing. Voi mainnet only.",
    {
      name: z
        .string()
        .describe(
          "Name label to register (without parent suffix, e.g. 'myname')"
        ),
      sender: z.string().describe("Buyer wallet address"),
      parent: z
        .string()
        .optional()
        .describe(
          "Parent domain (default 'voi'). Use 'wallet.voi' for wallet.voi names, 'founder.voi' for founder.voi names, etc."
        ),
      years: z
        .number()
        .optional()
        .describe("Registration duration in years (default 1)"),
    },
    async ({ name: nameLabel, sender, parent, years }) => {
      try {
        const { createHash } = await import("crypto");
        const network = "voi-mainnet";
        const algod = getAlgodClient(network);
        const indexer = getIndexerClient(network);
        const acc = { addr: sender, sk: new Uint8Array(0) };
        const duration = BigInt((years || 1) * 365 * 24 * 60 * 60);
        const parentName = parent || "voi";

        const REGISTRY_ID = 797607;
        const RESOLVER_ID = 797608;

        function namehash(name) {
          if (!name) return Buffer.alloc(32);
          const labels = name.split(".");
          let node = Buffer.alloc(32);
          for (let i = labels.length - 1; i >= 0; i--) {
            const labelHash = createHash("sha256")
              .update(Buffer.from(labels[i]))
              .digest();
            node = createHash("sha256")
              .update(Buffer.concat([node, labelHash]))
              .digest();
          }
          return node;
        }

        const registrarAbi = {
          name: "VNSRegistrar",
          methods: [
            {
              name: "get_price",
              args: [{ type: "byte[32]" }, { type: "uint256" }],
              returns: { type: "uint64" },
            },
            {
              name: "get_payment_token",
              args: [],
              returns: { type: "uint64" },
            },
            {
              name: "register",
              args: [
                { type: "byte[32]" },
                { type: "address" },
                { type: "uint256" },
              ],
              returns: { type: "byte[32]" },
            },
          ],
          events: [],
        };

        const resolverAbi = {
          name: "VNSResolver",
          methods: [
            {
              name: "setName",
              args: [{ type: "byte[32]" }, { type: "byte[256]" }],
              returns: { type: "void" },
            },
          ],
          events: [],
        };

        let registrarId;
        if (parentName === "voi") {
          registrarId = 797609;
        } else {
          const registryAbi = {
            name: "VNSRegistry",
            methods: [
              {
                name: "ownerOf",
                args: [{ type: "byte[32]" }],
                returns: { type: "address" },
              },
            ],
            events: [],
          };
          const ciRegistry = new CONTRACT(
            REGISTRY_ID, algod, indexer, registryAbi, acc
          );
          const ownerR = await ciRegistry.ownerOf(
            new Uint8Array(namehash(parentName))
          );
          if (!ownerR.success) {
            return failure(`Parent '${parentName}' not found in registry`);
          }
          const nodeOwner = ownerR.returnValue;
          const accInfo = await indexer
            .lookupAccountByID(nodeOwner)
            .do();
          const createdRound = Number(accInfo.account.createdAtRound);
          if (!createdRound) {
            return failure(
              `Could not determine registrar for '${parentName}'`
            );
          }
          const block = await indexer.lookupBlock(createdRound).do();
          const appTxn = block.transactions.find((t) => {
            if (t.txType !== "appl") return false;
            const id = t.applicationTransaction?.applicationId;
            return (
              id &&
              algosdk.getApplicationAddress(BigInt(id)).toString() ===
                nodeOwner
            );
          });
          if (!appTxn) {
            return failure(
              `Could not resolve registrar app for '${parentName}'`
            );
          }
          registrarId = Number(
            appTxn.applicationTransaction.applicationId
          );
        }

        const ciRegistrar = new CONTRACT(
          registrarId, algod, indexer, registrarAbi, acc
        );

        const [payTokenR, priceR] = await Promise.all([
          ciRegistrar.get_payment_token(),
          (() => {
            const nameBytes = new Uint8Array(32);
            for (let i = 0; i < nameLabel.length && i < 32; i++) {
              nameBytes[i] = nameLabel.charCodeAt(i);
            }
            return ciRegistrar.get_price(nameBytes, duration);
          })(),
        ]);

        if (!payTokenR.success) {
          return failure("Failed to query payment token");
        }
        if (!priceR.success) {
          return failure("Failed to query name price");
        }

        const paymentTokenId = Number(payTokenR.returnValue);
        const price = BigInt(priceR.returnValue);
        const registrarAddr = algosdk
          .getApplicationAddress(BigInt(registrarId))
          .toString();

        const ciTokenMeta = new arc200(
          paymentTokenId, algod, indexer, { acc }
        );
        const ntCi = new CONTRACT(
          paymentTokenId, algod, indexer, abi.nt200, acc
        );
        const [decR, symR, withdrawR] = await Promise.all([
          ciTokenMeta.arc200_decimals(),
          ciTokenMeta.arc200_symbol(),
          ntCi.withdraw(1),
        ]);
        const decimals = decR.success ? Number(decR.returnValue) : 6;
        const symbol = symR.success
          ? symR.returnValue.replace(/\0/g, "").trim()
          : String(paymentTokenId);
        const isNt200 =
          withdrawR.success ||
          !withdrawR.error?.includes("match label");

        const buildMode = [true, false, true];
        const nameBytes = new Uint8Array(32);
        for (let i = 0; i < nameLabel.length && i < 32; i++) {
          nameBytes[i] = nameLabel.charCodeAt(i);
        }

        const buildN = [];

        if (isNt200) {
          const balR = await ciTokenMeta.arc200_balanceOf(sender);
          const currentBal = balR.success ? balR.returnValue : 0n;
          if (currentBal === 0n || currentBal === BigInt(0)) {
            const ciCBB = new CONTRACT(
              paymentTokenId, algod, indexer, abi.nt200, acc,
              ...buildMode
            );
            const cbbObj = (
              await ciCBB.createBalanceBox(sender)
            ).obj;
            buildN.push({ ...cbbObj, payment: 28500 });
          }
          const ciDep = new CONTRACT(
            paymentTokenId, algod, indexer, abi.nt200, acc, ...buildMode
          );
          const depObj = (await ciDep.deposit(Number(price))).obj;
          buildN.push({ ...depObj, payment: Number(price) });
        }

        const ciApprove = new CONTRACT(
          paymentTokenId, algod, indexer, abi.arc200, acc, ...buildMode
        );
        const appObj = (
          await ciApprove.arc200_approve(registrarAddr, price)
        ).obj;
        buildN.push({ ...appObj, payment: 28501 });

        const ciRegBuild = new CONTRACT(
          registrarId, algod, indexer, registrarAbi, acc, ...buildMode
        );
        const regObj = (
          await ciRegBuild.register(nameBytes, sender, duration)
        ).obj;
        buildN.push({ ...regObj, payment: 336700 });

        const fullName = `${nameLabel}.${parentName}`;
        const fullNameBytes = new Uint8Array(256);
        for (let i = 0; i < fullName.length && i < 256; i++) {
          fullNameBytes[i] = fullName.charCodeAt(i);
        }
        const node = namehash(fullName);

        const ciResBuild = new CONTRACT(
          RESOLVER_ID, algod, indexer, resolverAbi, acc, ...buildMode
        );
        const resObj = (
          await ciResBuild.setName(new Uint8Array(node), fullNameBytes)
        ).obj;
        buildN.push({ ...resObj, payment: 336701 });

        const ci = new CONTRACT(
          registrarId, algod, indexer, abi.custom, acc
        );
        ci.setFee(15000);
        ci.setEnableGroupResourceSharing(true);
        ci.setExtraTxns(buildN);

        const customR = await ci.custom();
        if (!customR.success) {
          return failure(
            customR.error || "Failed to build registration transactions"
          );
        }

        const priceHuman = Number(price) / 10 ** decimals;

        return success({
          action: "envoi_purchase",
          name: fullName,
          sender,
          parent: parentName,
          years: years || 1,
          price: priceHuman,
          priceBase: String(price),
          paymentToken: paymentTokenId,
          paymentSymbol: symbol,
          paymentDecimals: decimals,
          depositsVoi: isNt200,
          registrarId,
          txns: customR.txns,
        });
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "aramid_bridge_txn",
    "Builds unsigned Aramid Bridge transactions for bridging assets between Voi and Algorand. Supports native tokens (VOI/ALGO) and ASAs. Returns base64-encoded transaction (string[]) for wallet signing. The 0.1% bridge fee is calculated automatically. Delivery is automatic on AVM destinations.",
    {
      sourceNetwork: z
        .enum(["voi-mainnet", "algorand-mainnet"])
        .describe("Network to bridge FROM"),
      sender: z.string().describe("Sender wallet address on source network"),
      destinationAddress: z
        .string()
        .describe("Recipient wallet address on destination network"),
      sourceToken: z
        .number()
        .describe("ASA ID of token on source network (0 for native VOI/ALGO)"),
      destinationToken: z
        .string()
        .describe(
          "Asset ID of token on destination network (as string, e.g. '2320775407' for aVoi on Algorand)"
        ),
      amount: z
        .string()
        .describe(
          "Total amount to bridge in base units (fee is deducted from this). E.g. '1000000' for 1 token with 6 decimals"
        ),
    },
    async ({
      sourceNetwork,
      sender,
      destinationAddress,
      sourceToken,
      destinationToken,
      amount,
    }) => {
      try {
        const BRIDGE_ADDRESS =
          "ARAMIDFJYV2TOFB5MRNZJIXBSAVZCVAUDAPFGKR5PNX4MTILGAZABBTXQQ";
        const DEST_CHAIN_IDS = {
          "voi-mainnet": 416101,
          "algorand-mainnet": 416001,
        };
        const destNetwork =
          sourceNetwork === "voi-mainnet"
            ? "algorand-mainnet"
            : "voi-mainnet";

        const totalBase = BigInt(amount);
        if (totalBase <= 0n) return failure("Amount must be positive");

        const feeAmount = totalBase / 1000n;
        const destinationAmount = totalBase - feeAmount;

        const noteObj = {
          destinationNetwork: DEST_CHAIN_IDS[destNetwork],
          destinationAddress,
          destinationToken: String(destinationToken),
          feeAmount: Number(feeAmount),
          destinationAmount: Number(destinationAmount),
          note: "aramid",
          sourceAmount: Number(destinationAmount),
        };
        const noteBytes = new Uint8Array(
          Buffer.from(JSON.stringify(noteObj))
        );

        const algod = getAlgodClient(sourceNetwork);
        const params = await algod.getTransactionParams().do();

        let txn;
        if (sourceToken === 0) {
          txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
            sender,
            receiver: BRIDGE_ADDRESS,
            amount: totalBase,
            suggestedParams: params,
            note: noteBytes,
          });
        } else {
          txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
            sender,
            receiver: BRIDGE_ADDRESS,
            amount: totalBase,
            assetIndex: sourceToken,
            suggestedParams: params,
            note: noteBytes,
          });
        }

        const encoded = algosdk.encodeUnsignedTransaction(txn);
        const b64 = Buffer.from(encoded).toString("base64");

        return success({
          action: "aramid_bridge",
          sourceNetwork,
          destinationNetwork: destNetwork,
          sender,
          destinationAddress,
          sourceToken,
          destinationToken,
          totalAmount: amount,
          feeAmount: String(feeAmount),
          destinationAmount: String(destinationAmount),
          bridgeAddress: BRIDGE_ADDRESS,
          txns: [b64],
        });
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "payment_txn",
    "Builds an unsigned native payment transaction (VOI or ALGO depending on network). Returns a base64-encoded transaction (string[]) for wallet signing.",
    {
      network: networkSchema,
      sender: z.string().describe("Sender wallet address"),
      receiver: z.string().describe("Recipient wallet address"),
      amount: z
        .string()
        .describe("Amount in microVOI/microALGO (1 VOI = 1,000,000 microVOI)"),
      note: z
        .string()
        .optional()
        .describe("Optional note to attach to the transaction"),
    },
    async ({ network, sender, receiver, amount, note }) => {
      try {
        const algod = getAlgodClient(network);
        const params = await algod.getTransactionParams().do();
        const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
          sender,
          receiver,
          amount: BigInt(amount),
          suggestedParams: params,
          ...(note
            ? { note: new Uint8Array(Buffer.from(note)) }
            : {}),
        });
        const encoded = algosdk.encodeUnsignedTransaction(txn);
        const b64 = Buffer.from(encoded).toString("base64");
        return success({
          action: "payment",
          network,
          sender,
          receiver,
          amount,
          note: note || null,
          txns: [b64],
        });
      } catch (err) {
        return failure(err.message);
      }
    }
  );
}
