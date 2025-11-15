import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import "./App.css";

const BAGGED_TOTES_DOC = doc(db, "totes", "baggedTotes");

export default function BaggedTotesCard() {
  // --- Bagged Totes State ---
  const [receivedAmbient, setReceivedAmbient] = useState("");
  const [receivedChill, setReceivedChill] = useState("");
  const [currentAmbient, setCurrentAmbient] = useState("");
  const [currentChill, setCurrentChill] = useState("");
  const [baggedAmbient, setBaggedAmbient] = useState(null);
  const [baggedChill, setBaggedChill] = useState(null);
  const [totalBagged, setTotalBagged] = useState(null);

  // --- Toast Notification ---
  const [toast, setToast] = useState({ show: false, message: "" });

  // --- Load data from Firestore ---
  useEffect(() => {
    const unsubscribe = onSnapshot(BAGGED_TOTES_DOC, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setReceivedAmbient(data.receivedAmbient || "");
        setReceivedChill(data.receivedChill || "");
        setCurrentAmbient(data.currentAmbient || "");
        setCurrentChill(data.currentChill || "");
        setBaggedAmbient(data.baggedAmbient ?? null);
        setBaggedChill(data.baggedChill ?? null);
        setTotalBagged(data.totalBagged ?? null);
      }
    });
    return () => unsubscribe();
  }, []);

  // --- Toast Helper ---
  const showToast = (msg) => {
    setToast({ show: true, message: msg });
    setTimeout(() => setToast({ show: false, message: "" }), 2000);
  };

  // --- Actions ---
  const calculateBaggedTotes = async () => {
    const ambient = (parseInt(currentAmbient, 10) || 0) + (parseInt(receivedAmbient, 10) || 0);
    const chill = (parseInt(currentChill, 10) || 0) + (parseInt(receivedChill, 10) || 0);
    setBaggedAmbient(ambient);
    setBaggedChill(chill);
    setTotalBagged(ambient + chill);

    await setDoc(
      BAGGED_TOTES_DOC,
      {
        receivedAmbient,
        receivedChill,
        currentAmbient,
        currentChill,
        baggedAmbient: ambient,
        baggedChill: chill,
        totalBagged: ambient + chill,
      },
      { merge: true }
    );

    showToast("Bagged Totes Saved");
  };

  const clearBaggedTotes = async () => {
    setReceivedAmbient("");
    setReceivedChill("");
    setCurrentAmbient("");
    setCurrentChill("");
    setBaggedAmbient(null);
    setBaggedChill(null);
    setTotalBagged(null);

    await setDoc(
      BAGGED_TOTES_DOC,
      {
        receivedAmbient: "",
        receivedChill: "",
        currentAmbient: "",
        currentChill: "",
        baggedAmbient: null,
        baggedChill: null,
        totalBagged: null,
      },
      { merge: true }
    );
  };

  return (
    <section className="data-card bagged-card" style={{ position: "relative" }}>
      <h2 className="data-title">Bagged Totes</h2>

      <div className="bagged-fields">
        {[
          { label: "Ambient totes received:", value: receivedAmbient, setter: setReceivedAmbient },
          { label: "Chill totes received:", value: receivedChill, setter: setReceivedChill },
          { label: "Current totes in hive bagged ambient:", value: currentAmbient, setter: setCurrentAmbient },
          { label: "Current totes in hive bagged chill:", value: currentChill, setter: setCurrentChill },
        ].map((field, i) => (
          <div key={i} className="bagged-row">
            <span>{field.label}</span>
            <input
              type="number"
              value={field.value}
              onChange={(e) => field.setter(e.target.value)}
            />
          </div>
        ))}
      </div>

      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <button className="calculate-btn" onClick={calculateBaggedTotes}>
          Calculate & Save Bagged Totes
        </button>
        <button className="clear-btn" onClick={clearBaggedTotes}>
          Clear Bagged Totes
        </button>
      </div>

      {baggedAmbient !== null && baggedChill !== null && (
        <div className="bagged-result">
          <div className="result-line">
            <span>Bagged Ambient Totes:</span> <span>{baggedAmbient}</span>
          </div>
          <div className="result-line">
            <span>Bagged Chill Totes:</span> <span>{baggedChill}</span>
          </div>
          <div className="result-line">
            <span>Total Bagged Totes:</span> <span>{totalBagged}</span>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div className="toast-notification-center">{toast.message}</div>
      )}
    </section>
  );
}
