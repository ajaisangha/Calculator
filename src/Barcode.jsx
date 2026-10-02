import React, { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import "./barcode.css";

const BARCODE_DOC = doc(db, "totes", "barcodeGenerator");

export default function BarcodeCard() {
  const [barcodeText, setBarcodeText] = useState("");
  const [savedBarcodeText, setSavedBarcodeText] = useState("");
  const [hasBarcode, setHasBarcode] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "" });

  const barcodeRef = useRef(null);
  const toastTimerRef = useRef(null);

  const showToast = (message) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    setToast({ show: true, message });

    toastTimerRef.current = setTimeout(() => {
      setToast({ show: false, message: "" });
      toastTimerRef.current = null;
    }, 1800);
  };

  const clearSvg = () => {
    if (barcodeRef.current) {
      barcodeRef.current.innerHTML = "";
    }
  };

  const renderBarcode = (value) => {
    if (!barcodeRef.current || !value.trim()) {
      clearSvg();
      setHasBarcode(false);
      return;
    }

    try {
      clearSvg();

      JsBarcode(barcodeRef.current, value, {
        format: "CODE128",
        lineColor: "#1f2937",
        width: 2,
        height: 90,
        displayValue: true,
        text: value,
        font: "monospace",
        fontSize: 18,
        textMargin: 6,
        margin: 12,
      });

      setHasBarcode(true);
    } catch (error) {
      console.error("Barcode render error:", error);
      clearSvg();
      setHasBarcode(false);
    }
  };

  const copySvgAsPng = async (svgElement, successMessage) => {
    if (!svgElement) {
      showToast("Copy failed");
      return;
    }

    try {
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svgElement);

      const svgBlob = new Blob([svgString], {
        type: "image/svg+xml;charset=utf-8",
      });

      const svgUrl = URL.createObjectURL(svgBlob);
      const image = new Image();

      image.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const width = image.width || 600;
          const height = image.height || 170;

          canvas.width = width;
          canvas.height = height;

          const context = canvas.getContext("2d");

          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, width, height);
          context.drawImage(image, 0, 0);

          canvas.toBlob(
            async (blob) => {
              try {
                if (!blob) {
                  showToast("Copy failed");
                  return;
                }

                await navigator.clipboard.write([
                  new ClipboardItem({
                    "image/png": blob,
                  }),
                ]);

                showToast(successMessage);
              } catch (error) {
                console.error("Clipboard copy error:", error);
                showToast("Clipboard copy not supported");
              }
            },
            "image/png",
            1
          );
        } finally {
          URL.revokeObjectURL(svgUrl);
        }
      };

      image.onerror = () => {
        URL.revokeObjectURL(svgUrl);
        showToast("Copy failed");
      };

      image.src = svgUrl;
    } catch (error) {
      console.error("Barcode copy error:", error);
      showToast("Copy failed");
    }
  };

  const copyBarcodeWithText = async () => {
    if (!barcodeRef.current || !hasBarcode) return;

    await copySvgAsPng(barcodeRef.current, "Barcode With Text Copied");
  };

  const copyBarcodeOnly = async () => {
    const value = savedBarcodeText.trim();

    if (!value) return;

    try {
      /*
        Create a separate SVG only for copying.
        The visible preview remains unchanged and continues showing text.
      */
      const barcodeOnlySvg = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg"
      );

      JsBarcode(barcodeOnlySvg, value, {
        format: "CODE128",
        lineColor: "#1f2937",
        width: 2,
        height: 90,
        displayValue: false,
        margin: 12,
      });

      await copySvgAsPng(barcodeOnlySvg, "Barcode Only Copied");
    } catch (error) {
      console.error("Barcode-only copy error:", error);
      showToast("Copy failed");
    }
  };

  useEffect(() => {
    const unsubscribe = onSnapshot(BARCODE_DOC, (snapshot) => {
      if (!snapshot.exists()) {
        setBarcodeText("");
        setSavedBarcodeText("");
        setHasBarcode(false);
        clearSvg();
        return;
      }

      const data = snapshot.data() || {};
      const savedText = data.barcodeText || "";
      const generated = data.generated || false;

      setBarcodeText(savedText);
      setSavedBarcodeText(savedText);

      if (generated && savedText.trim()) {
        renderBarcode(savedText);
      } else {
        clearSvg();
        setHasBarcode(false);
      }
    });

    const handleClearAll = () => {
      setBarcodeText("");
      setSavedBarcodeText("");
      setHasBarcode(false);
      clearSvg();
    };

    window.addEventListener("shift-planner-clear-all", handleClearAll);

    return () => {
      unsubscribe();
      window.removeEventListener("shift-planner-clear-all", handleClearAll);

      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const handleGenerate = async () => {
    const value = barcodeText.trim();

    if (!value) {
      clearSvg();
      setHasBarcode(false);
      return;
    }

    renderBarcode(value);

    try {
      await setDoc(
        BARCODE_DOC,
        {
          barcodeText: value,
          generated: true,
        },
        { merge: true }
      );

      setSavedBarcodeText(value);
      showToast("Barcode Generated");
    } catch (error) {
      console.error("Barcode save error:", error);
      showToast("Could not save barcode");
    }
  };

  const handleClear = async () => {
    setBarcodeText("");
    setSavedBarcodeText("");
    setHasBarcode(false);
    clearSvg();

    try {
      await setDoc(
        BARCODE_DOC,
        {
          barcodeText: "",
          generated: false,
        },
        { merge: true }
      );

      showToast("Barcode Cleared");
    } catch (error) {
      console.error("Barcode clear error:", error);
      showToast("Could not clear barcode");
    }
  };

  return (
    <section className="data-card barcode-card">
      <h2 className="data-title">Barcode Generator</h2>

      <div className="barcode-subcard">
        <div className="barcode-form">
          <label htmlFor="barcodeText" className="barcode-label">
            Enter text
          </label>

          <input
            id="barcodeText"
            type="text"
            value={barcodeText}
            onChange={(event) => setBarcodeText(event.target.value)}
            className="barcode-input"
            placeholder="Enter text for barcode"
          />

          <div className="barcode-button-row">
            <button
              type="button"
              className="calculate-btn"
              onClick={handleGenerate}
            >
              Generate
            </button>

            <button
              type="button"
              className="clear-btn"
              onClick={handleClear}
            >
              Clear
            </button>
          </div>
        </div>

        <div className="barcode-preview-box">
          {!hasBarcode && !savedBarcodeText && (
            <div className="barcode-empty">
              Generated barcode will appear here
            </div>
          )}

          <svg ref={barcodeRef} className="barcode-svg" />
        </div>

        <div className="barcode-copy-row">
          <button
            type="button"
            className="calculate-btn copy-btn"
            onClick={copyBarcodeWithText}
            disabled={!hasBarcode}
          >
            Copy With Text
          </button>

          <button
            type="button"
            className="barcode-only-copy-btn"
            onClick={copyBarcodeOnly}
            disabled={!hasBarcode}
          >
            Copy Barcode Only
          </button>
        </div>
      </div>

      {toast.show && (
        <div className="toast-notification-center">{toast.message}</div>
      )}
    </section>
  );
}