/**
 * Clipboard Utility Functions
 * Helper functions for copying text to clipboard with fallbacks for different environments
 */

/**
 * Copies text to clipboard using the best available method
 * @param {string} text - The text to copy
 */
function copyToClipboard(text) {
  console.log("Attempting to copy text:", text);

  // Check environment context
  const isSecureContext = window.isSecureContext;
  const isLocalhost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  const hasClipboardAPI = !!navigator.clipboard;

  // Try using the modern Clipboard API first
  if (navigator.clipboard && (window.isSecureContext || isLocalhost)) {
    console.log("Using Clipboard API");
    navigator.clipboard.writeText(text).then(
      function () {
        console.log("Clipboard API success");
        showSuccessFeedback();
      },
      function (err) {
        console.error("Clipboard API failed:", err);
        fallbackCopyMethod(text);
      }
    );
  } else {
    // Fall back to older methods
    console.log("Using fallback method");
    fallbackCopyMethod(text);
  }
}

/**
 * Fallback method for browsers that don't support the Clipboard API
 * @param {string} text - The text to copy
 */
function fallbackCopyMethod(text) {
  try {
    // Create a temporary textarea element
    const textarea = document.createElement("textarea");
    textarea.value = text;

    // Make it non-editable to avoid focus and ensure it's not visible
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    textarea.style.opacity = "0";

    // Append to the document, select all text, and copy
    document.body.appendChild(textarea);
    textarea.select();

    const successful = document.execCommand("copy");
    document.body.removeChild(textarea);

    if (successful) {
      showSuccessFeedback();
    } else {
      showErrorFeedback();
    }
  } catch (err) {
    console.error("Fallback copy method failed:", err);
    showErrorFeedback();
  }
}

/**
 * Show visual feedback for successful copy
 * Uses the .copy-btn element in the DOM
 */
function showSuccessFeedback() {
  const copyBtn = document.querySelector(".copy-btn");
  if (!copyBtn) return;

  const originalIcon = copyBtn.innerHTML;

  // Change to checkmark and add success class
  copyBtn.innerHTML = '<i class="fas fa-check"></i>';
  copyBtn.classList.add("btn-success");
  copyBtn.classList.remove("btn-outline-secondary");

  // Change back after 1.5 seconds
  setTimeout(function () {
    copyBtn.innerHTML = originalIcon;
    copyBtn.classList.remove("btn-success");
    copyBtn.classList.add("btn-outline-secondary");
  }, 1500);
}

/**
 * Show visual feedback for failed copy
 * Uses the .copy-btn element in the DOM
 */
function showErrorFeedback() {
  const copyBtn = document.querySelector(".copy-btn");
  if (!copyBtn) return;

  copyBtn.innerHTML = '<i class="fas fa-times"></i>';
  copyBtn.classList.add("btn-danger");
  copyBtn.classList.remove("btn-outline-secondary");

  setTimeout(function () {
    copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
    copyBtn.classList.remove("btn-danger");
    copyBtn.classList.add("btn-outline-secondary");
  }, 1500);
}
