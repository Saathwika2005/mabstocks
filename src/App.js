import React, { useState, useEffect } from "react";

const API_KEY = "YARZ8O61773NYOYIS"; // Replace with your API key

const STOCKS_LIST = [
  "AAPL",
  "MSFT",
  "GOOGL",
  "AMZN",
  "TSLA",
  "META",
  "NVDA",
  "JPM",
  "V",
  "DIS",
  "NFLX",
  "ADBE",
  "INTC",
  "CSCO",
  "ORCL",
  "BAC",
  "WMT",
  "PG",
  "MA",
  "XOM",
  "KO",
  "PEP",
  "CVX",
  "MRK",
];

function fetchIntradayReturn(symbol) {
  return fetch(
    `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=5min&apikey=${API_KEY}`
  )
    .then((res) => res.json())
    .then((data) => {
      const ts = data["Time Series (5min)"];
      if (!ts) return 0;
      const sortedTimes = Object.keys(ts).sort((a, b) => new Date(b) - new Date(a));
      const latest = ts[sortedTimes[0]];
      const earliest = ts[sortedTimes[sortedTimes.length - 1]];

      const latestPrice = parseFloat(latest["4. close"]);
      const openPrice = parseFloat(earliest["1. open"]);

      if (!openPrice || !latestPrice) return 0;

      return ((latestPrice - openPrice) / openPrice) * 100;
    })
    .catch(() => 0);
}

// Epsilon-Greedy Algorithm
function epsilonGreedy(arms, epsilon, plays, rewards) {
  if (Math.random() < epsilon) {
    // Explore: choose random arm
    return Math.floor(Math.random() * arms);
  } else {
    // Exploit: choose best arm
    let bestValue = -Infinity;
    let bestIndex = 0;
    for (let i = 0; i < arms; i++) {
      const avgReward = plays[i] ? rewards[i] / plays[i] : 0;
      if (avgReward > bestValue) {
        bestValue = avgReward;
        bestIndex = i;
      }
    }
    return bestIndex;
  }
}

// Thompson Sampling for Gaussian rewards (approx)
function thompsonSampling(arms, plays, rewards) {
  let maxSample = -Infinity;
  let bestArm = 0;
  for (let i = 0; i < arms; i++) {
    const alpha = rewards[i] + 1;
    const beta = plays[i] - rewards[i] + 1;
    const sample = betaSample(alpha, beta);
    if (sample > maxSample) {
      maxSample = sample;
      bestArm = i;
    }
  }
  return bestArm;
}

// Simple Beta sampler using Johnk's method (demo)
function betaSample(alpha, beta) {
  const gammaSample = (shape) => {
    if (shape < 1) {
      let done = false;
      let x, y;
      while (!done) {
        x = Math.pow(Math.random(), 1 / shape);
        y = Math.pow(Math.random(), 1 / (1 - shape));
        if (x + y <= 1) done = true;
      }
      return (-Math.log(Math.random()) * x) / (x + y);
    } else {
      const d = shape - 1 / 3;
      const c = 1 / Math.sqrt(9 * d);
      while (true) {
        let x = normalSample();
        let v = Math.pow(1 + c * x, 3);
        if (
          v > 0 &&
          Math.log(Math.random()) <
            0.5 * x * x + d - d * v + d * Math.log(v)
        ) {
          return d * v;
        }
      }
    }
  };

  const normalSample = () => {
    let u = 0,
      v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  };

  const x = gammaSample(alpha);
  const y = gammaSample(beta);
  return x / (x + y);
}

// UCB1 Algorithm
function ucb1(arms, plays, rewards, totalPlays) {
  for (let i = 0; i < arms; i++) {
    if (plays[i] === 0) return i; // Play each arm once
  }
  let bestValue = -Infinity;
  let bestArm = 0;
  for (let i = 0; i < arms; i++) {
    const avgReward = rewards[i] / plays[i];
    const confidence = Math.sqrt((2 * Math.log(totalPlays)) / plays[i]);
    const ucb = avgReward + confidence;
    if (ucb > bestValue) {
      bestValue = ucb;
      bestArm = i;
    }
  }
  return bestArm;
}

export default function App() {
  const [selectedStocks, setSelectedStocks] = useState([]);
  const [plays, setPlays] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [logs, setLogs] = useState([]);
  const [algorithm, setAlgorithm] = useState("epsilon");
  const [epsilon, setEpsilon] = useState(0.1);
  const [finalResult, setFinalResult] = useState(null);

  // Reset plays and rewards whenever selectedStocks changes to exactly 10
  useEffect(() => {
    if (selectedStocks.length === 10) {
      setPlays(Array(10).fill(0));
      setRewards(Array(10).fill(0));
      setLogs([]);
      setFinalResult(null);
    } else {
      setPlays([]);
      setRewards([]);
      setLogs([]);
      setFinalResult(null);
    }
  }, [selectedStocks]);

  const toggleStock = (symbol) => {
    if (selectedStocks.includes(symbol)) {
      setSelectedStocks(selectedStocks.filter((s) => s !== symbol));
    } else if (selectedStocks.length < 10) {
      setSelectedStocks([...selectedStocks, symbol]);
    }
  };

  const runStep = async () => {
    if (selectedStocks.length !== 10) {
      alert("Please select exactly 10 stocks.");
      return;
    }

    let chosenIndex = 0;
    const totalPlays = plays.reduce((a, b) => a + b, 0);

    switch (algorithm) {
      case "epsilon":
        chosenIndex = epsilonGreedy(selectedStocks.length, epsilon, plays, rewards);
        break;
      case "thompson":
        chosenIndex = thompsonSampling(selectedStocks.length, plays, rewards);
        break;
      case "ucb":
        chosenIndex = ucb1(selectedStocks.length, plays, rewards, totalPlays);
        break;
      default:
        chosenIndex = 0;
    }

    const stock = selectedStocks[chosenIndex];
    const reward = await fetchIntradayReturn(stock);

    // Update plays and rewards
    const newPlays = [...plays];
    const newRewards = [...rewards];
    newPlays[chosenIndex] += 1;
    newRewards[chosenIndex] += reward;

    setPlays(newPlays);
    setRewards(newRewards);

    setLogs([
      {
        step: totalPlays + 1,
        chosenStock: stock,
        reward: reward.toFixed(2) + "%",
        algorithm,
      },
      ...logs,
    ]);

    setFinalResult(null); // Reset final result after each step
  };

  const reset = () => {
    setPlays(Array(selectedStocks.length).fill(0));
    setRewards(Array(selectedStocks.length).fill(0));
    setLogs([]);
    setFinalResult(null);
  };

  const showFinalResult = () => {
    if (plays.length === 0) {
      alert("No data available. Run some steps first.");
      return;
    }
    let bestIndex = 0;
    let bestAvgReward = -Infinity;
    for (let i = 0; i < plays.length; i++) {
      const avgReward = plays[i] ? rewards[i] / plays[i] : -Infinity;
      if (avgReward > bestAvgReward) {
        bestAvgReward = avgReward;
        bestIndex = i;
      }
    }
    setFinalResult({
      stock: selectedStocks[bestIndex],
      avgReward: bestAvgReward,
    });
  };

  return (
    <div
      style={{
        maxWidth: 750,
        margin: "auto",
        padding: 30,
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        backgroundColor: "#f0faf9",
        borderRadius: 12,
        boxShadow: "0 8px 16px rgba(0,0,0,0.1)",
        color: "#064635",
      }}
    >
      <h1 style={{ textAlign: "center", marginBottom: 30, color: "#0b6659" }}>
        Stock Selector using Multi-Armed Bandit
      </h1>

      <h3 style={{ marginBottom: 10, color: "#0b6659" }}>Select exactly 10 stocks:</h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        {STOCKS_LIST.map((stock) => (
          <button
            key={stock}
            onClick={() => toggleStock(stock)}
            style={{
              padding: "8px 14px",
              borderRadius: 20,
              border: selectedStocks.includes(stock)
                ? "2px solid #42b883"
                : "2px solid #a3d9ca",
              backgroundColor: selectedStocks.includes(stock)
                ? "#d2f0e4"
                : "#e6f4f1",
              color: selectedStocks.includes(stock) ? "#064635" : "#4a6564",
              cursor: "pointer",
              fontWeight: "600",
              minWidth: 55,
              textAlign: "center",
              userSelect: "none",
              transition: "all 0.3s ease",
            }}
          >
            {stock}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: 20 }}>
        <label
          htmlFor="algorithm-select"
          style={{ fontWeight: "bold", marginRight: 10, color: "#0b6659" }}
        >
          Algorithm:
        </label>
        <select
          id="algorithm-select"
          value={algorithm}
          onChange={(e) => setAlgorithm(e.target.value)}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "1.5px solid #42b883",
            fontSize: 16,
            color: "#064635",
            backgroundColor: "#e6f4f1",
            cursor: "pointer",
          }}
        >
          <option value="epsilon">Epsilon-Greedy</option>
          <option value="thompson">Thompson Sampling</option>
          <option value="ucb">UCB1</option>
        </select>

        {algorithm === "epsilon" && (
          <input
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={epsilon}
            onChange={(e) => setEpsilon(parseFloat(e.target.value))}
            style={{
              marginLeft: 15,
              width: 70,
              padding: "6px 8px",
              borderRadius: 8,
              border: "1.5px solid #42b883",
              fontSize: 16,
              color: "#064635",
              backgroundColor: "#e6f4f1",
            }}
            title="Epsilon value for epsilon-greedy algorithm"
          />
        )}
      </div>

      <div>
        <button
          onClick={runStep}
          disabled={selectedStocks.length !== 10}
          style={{
            padding: "12px 25px",
            backgroundColor: selectedStocks.length === 10 ? "#42b883" : "#9bd1bc",
            color: "#fff",
            border: "none",
            borderRadius: 25,
            cursor: selectedStocks.length === 10 ? "pointer" : "not-allowed",
            fontSize: 16,
            fontWeight: "bold",
            marginRight: 15,
            transition: "background-color 0.3s ease",
          }}
        >
          Run Step
        </button>

        <button
          onClick={reset}
          disabled={plays.length === 0}
          style={{
            padding: "12px 25px",
            backgroundColor: plays.length > 0 ? "#2c7a7b" : "#8fc1c1",
            color: "#fff",
            border: "none",
            borderRadius: 25,
            cursor: plays.length > 0 ? "pointer" : "not-allowed",
            fontSize: 16,
            fontWeight: "bold",
            marginRight: 15,
            transition: "background-color 0.3s ease",
          }}
        >
          Reset
        </button>

        <button
          onClick={showFinalResult}
          disabled={plays.length === 0}
          style={{
            padding: "12px 25px",
            backgroundColor: plays.length > 0 ? "#319795" : "#8fc1c1",
            color: "#fff",
            border: "none",
            borderRadius: 25,
            cursor: plays.length > 0 ? "pointer" : "not-allowed",
            fontSize: 16,
            fontWeight: "bold",
            transition: "background-color 0.3s ease",
          }}
        >
          Show Final Result
        </button>
      </div>

      {finalResult && (
        <div
          style={{
            marginTop: 30,
            padding: 20,
            backgroundColor: "#d1e7dd",
            borderRadius: 12,
            fontWeight: "bold",
            fontSize: 18,
            color: "#064635",
            textAlign: "center",
            boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
          }}
        >
          Best Stock:{" "}
          <span style={{ color: "#2f855a", fontSize: 20 }}>{finalResult.stock}</span> with
          Average Reward:{" "}
          <span style={{ color: "#276749", fontSize: 20 }}>
            {finalResult.avgReward.toFixed(2)}%
          </span>
        </div>
      )}

      <div style={{ marginTop: 40, maxHeight: 300, overflowY: "auto" }}>
        <h3 style={{ color: "#0b6659" }}>Logs:</h3>
        {logs.length === 0 && (
          <p style={{ color: "#375a52", fontStyle: "italic" }}>No steps run yet.</p>
        )}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 14,
            color: "#064635",
          }}
        >
          <thead>
            <tr style={{ backgroundColor: "#a3d9ca" }}>
              <th style={{ padding: 10, borderBottom: "2px solid #42b883" }}>Step</th>
              <th style={{ padding: 10, borderBottom: "2px solid #42b883" }}>
                Chosen Stock
              </th>
              <th style={{ padding: 10, borderBottom: "2px solid #42b883" }}>Reward</th>
              <th style={{ padding: 10, borderBottom: "2px solid #42b883" }}>
                Algorithm
              </th>
            </tr>
          </thead>
          <tbody>
            {logs.map(({ step, chosenStock, reward, algorithm }, idx) => (
              <tr
                key={idx}
                style={{
                  backgroundColor: idx % 2 === 0 ? "#e6f4f1" : "#d2f0e4",
                }}
              >
                <td style={{ padding: 8, textAlign: "center" }}>{step}</td>
                <td style={{ padding: 8, textAlign: "center", fontWeight: "600" }}>
                  {chosenStock}
                </td>
                <td style={{ padding: 8, textAlign: "center" }}>{reward}</td>
                <td style={{ padding: 8, textAlign: "center" }}>{algorithm}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
