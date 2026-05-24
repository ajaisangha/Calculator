import React, { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import "./barcode.css";
import "./App.css";

const BARCODE_DOC = doc(db, "totes", "barcodeGenerator");

export default function BarcodeCard() {
  const [barcodeText, setBarcodeText] = useState("");
  const [savedBarcodeText, setSavedBarcodeText] = useState("");
  const [hasBarcode, setHasBarcode] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "" });
  const barcodeRef = useRef(null);

  const showToast = (message) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: "" }), 1800);
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
        margin: 12,
        fontSize: 18,
      });
      setHasBarcode(true);
    } catch (error) {
      clearSvg();
      setHasBarcode(false);
    }
  };

  useEffect(() => {
    const unsub = onSnapshot(BARCODE_DOC, (snap) => {
      if (!snap.exists()) {
        setBarcodeText("");
        setSavedBarcodeText("");
        setHasBarcode(false);
        clearSvg();
        return;
      }

      const data = snap.data() || {};
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

    return () => unsub();
  }, []);

  const handleGenerate = async () => {
    const value = barcodeText.trim();
    if (!value) {
      clearSvg();
      setHasBarcode(false);
      return;
    }

    renderBarcode(value);

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
  };

  const handleClear = async () => {
    setBarcodeText("");
    setSavedBarcodeText("");
    setHasBarcode(false);
    clearSvg();

    await setDoc(
      BARCODE_DOC,
      {
        barcodeText: "",
        generated: false,
      },
      { merge: true }
    );

    showToast("Barcode Cleared");
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
            onChange={(e) => setBarcodeText(e.target.value)}
            className="barcode-input"
            placeholder="Enter text for barcode"
          />

          <div className="barcode-button-row">
            <button className="calculate-btn" onClick={handleGenerate}>
              Generate
            </button>
            <button className="clear-btn" onClick={handleClear}>
              Clear
            </button>
          </div>
        </div>

        <div className="barcode-preview-box">
          {(!hasBarcode && !savedBarcodeText) && (
            <div className="barcode-empty">Generated barcode will appear here</div>
          )}
          <svg ref={barcodeRef} className="barcode-svg" />
        </div>
      </div>

      {toast.show && <div className="toast-notification-center">{toast.message}</div>}
    </section>
  );
}