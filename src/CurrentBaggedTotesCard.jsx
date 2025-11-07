import React, { useState } from "react";
import "./App.css";

export default function CurrentBaggedTotesCard() {
  const [currentAmbient, setCurrentAmbient] = useState("");
  const [currentChill, setCurrentChill] = useState("");
  const [neededAmbient, setNeededAmbient] = useState("");
  const [neededChill, setNeededChill] = useState("");
  const [resultAmbient, setResultAmbient] = useState(null);
  const [resultChill, setResultChill] = useState(null);

  const calculateTotes = () => {
    const ambient = (parseInt(currentAmbient, 10) || 0) - (parseInt(neededAmbient, 10) || 0);
    const chill = (parseInt(currentChill, 10) || 0) - (parseInt(neededChill, 10) || 0);
    setResultAmbient(ambient);
    setResultChill(chill);
  };

  const clearFields = () => {
    setCurrentAmbient("");
    setCurrentChill("");
    setNeededAmbient("");
    setNeededChill("");
    setResultAmbient(null);
    setResultChill(null);
  };

  return (
    <section className="data-card bagged-card">
      <h2 className="data-title">Current Bagged Totes</h2>

      <div className="bagged-fields">
        <div className="bagged-row">
          <span>Current totes ambient:</span>
          <input
            type="number"
            value={currentAmbient}
            onChange={(e) => setCurrentAmbient(e.target.value)}
          />
        </div>
        <div className="bagged-row">
          <span>Current totes chill:</span>
          <input
            type="number"
            value={currentChill}
            onChange={(e) => setCurrentChill(e.target.value)}
          />
        </div>
        <div className="bagged-row">
          <span>Totes needed ambient:</span>
          <input
            type="number"
            value={neededAmbient}
            onChange={(e) => setNeededAmbient(e.target.value)}
          />
        </div>
        <div className="bagged-row">
          <span>Totes needed chill:</span>
          <input
            type="number"
            value={neededChill}
            onChange={(e) => setNeededChill(e.target.value)}
          />
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <button onClick={calculateTotes} className="clear-btn" style={{ marginRight: 8 }}>
          Calculate
        </button>
        <button onClick={clearFields} className="clear-btn">
          Clear
        </button>
      </div>

      {resultAmbient !== null && resultChill !== null && (
        <div className="bagged-result">
          <div className="result-line">
            <span>Totes after pick (Ambient):</span>
            <span>{resultAmbient}</span>
          </div>
          <div className="result-line">
            <span>Totes after pick (Chill):</span>
            <span>{resultChill}</span>
          </div>
        </div>
      )}
    </section>
  );
}
