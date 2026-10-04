// Pays an order in USDC from the shopper's browser wallet (MetaMask), then
// asks the server to verify the transaction on the blockchain.
(function () {
  const root = document.querySelector("[data-crypto-pay]");
  if (!root) return;

  const cfg = root.dataset;
  const chainIdHex = "0x" + Number(cfg.chainId).toString(16);
  const button = root.querySelector("[data-pay-button]");
  const statusBox = root.querySelector("[data-pay-status]");
  const countdown = root.querySelector("[data-countdown]");
  const storageKey = `azanmart-tx-${cfg.order}`;
  const POLL_EVERY_MS = 4000;
  const MAX_POLLS = 75; // about 5 minutes

  const STATUS_STYLES = {
    info: "bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100",
    success: "bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-200",
    error: "bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200",
  };

  function showStatus(type, message, txHash) {
    statusBox.className = `mt-4 rounded-lg px-4 py-3 text-sm ${STATUS_STYLES[type]}`;
    statusBox.textContent = message;
    if (txHash) {
      const link = document.createElement("a");
      link.href = `${cfg.explorerUrl}/tx/${txHash}`;
      link.target = "_blank";
      link.rel = "noopener";
      link.className = "block mt-1 underline";
      link.textContent = "View the transaction on the block explorer";
      statusBox.append(link);
    }
  }

  const remember = (hash) => {
    try {
      localStorage.setItem(storageKey, hash);
    } catch {
      // Storage may be blocked; the shopper can still paste the hash by hand
    }
  };
  const recalled = () => {
    try {
      return localStorage.getItem(storageKey);
    } catch {
      return null;
    }
  };

  // ERC-20 transfer(address,uint256): the function selector plus two 32-byte arguments
  function transferData(to, amount) {
    const pad = (hex) => hex.replace(/^0x/, "").padStart(64, "0");
    return "0xa9059cbb" + pad(to) + pad(BigInt(amount).toString(16));
  }

  async function useRightNetwork(ethereum) {
    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainIdHex }],
      });
    } catch (err) {
      // 4902: the wallet doesn't know this network yet, so offer to add it
      if (err.code !== 4902) throw err;
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: chainIdHex,
            chainName: cfg.chainName,
            rpcUrls: [cfg.rpcUrl],
            blockExplorerUrls: [cfg.explorerUrl],
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          },
        ],
      });
    }
  }

  async function confirmOnServer(txHash) {
    const res = await fetch(`/orders/${cfg.order}/crypto`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": cfg.csrf },
      body: JSON.stringify({ txHash }),
    });
    if (!res.ok) return { status: "pending" }; // e.g. rate limited; try again shortly
    return res.json();
  }

  async function waitForConfirmation(txHash) {
    button.disabled = true;
    showStatus("info", "Payment sent. Waiting for the blockchain to confirm it…", txHash);

    for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
      const result = await confirmOnServer(txHash);
      if (result.status === "paid") {
        showStatus("success", "Payment confirmed! Taking you to your order…", txHash);
        setTimeout(() => (window.location.href = `/orders/${cfg.order}`), 1500);
        return;
      }
      if (result.status === "failed") {
        showStatus("error", result.message, txHash);
        button.disabled = false;
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_EVERY_MS));
    }

    showStatus(
      "info",
      "This is taking longer than usual. Your payment is safe; refresh this page in a few minutes to check again.",
      txHash,
    );
  }

  async function pay() {
    const { ethereum } = window;
    if (!ethereum) {
      showStatus(
        "error",
        "No crypto wallet found. Install MetaMask (metamask.io), or pay from another wallet and paste the transaction hash below.",
      );
      return;
    }

    button.disabled = true;
    try {
      showStatus("info", "Connecting to your wallet…");
      const [account] = await ethereum.request({ method: "eth_requestAccounts" });

      showStatus("info", `Switching to ${cfg.chainName}…`);
      await useRightNetwork(ethereum);

      showStatus("info", "Please confirm the payment in your wallet.");
      const txHash = await ethereum.request({
        method: "eth_sendTransaction",
        params: [{ from: account, to: cfg.token, data: transferData(cfg.receiver, cfg.amount) }],
      });

      remember(txHash);
      await waitForConfirmation(txHash);
    } catch (err) {
      button.disabled = false;
      // 4001: the shopper clicked "Reject" in the wallet
      showStatus(
        "error",
        err.code === 4001
          ? "You cancelled the payment in your wallet. Nothing was sent."
          : err.message || "Something went wrong with the wallet.",
      );
    }
  }

  function startCountdown() {
    const deadline = new Date(cfg.expires).getTime();
    const tick = () => {
      const left = Math.max(0, deadline - Date.now());
      const minutes = Math.floor(left / 60000);
      const seconds = Math.floor((left % 60000) / 1000);
      countdown.textContent = `${minutes}:${String(seconds).padStart(2, "0")}`;
      if (left === 0) {
        clearInterval(timer);
        if (!recalled()) {
          button.disabled = true;
          showStatus(
            "error",
            "The payment window has closed. Your items have been put back on sale.",
          );
        }
      }
    };
    const timer = setInterval(tick, 1000);
    tick();
  }

  button.addEventListener("click", pay);
  startCountdown();

  // Coming back after a reload: keep checking the payment that was already sent
  const pendingHash = recalled();
  if (pendingHash) waitForConfirmation(pendingHash);
})();
