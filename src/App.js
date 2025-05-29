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
  // Use normal distribution with mean and variance = 1/play count
  // For simplicity, use Beta approximation here with successes = rewards, failures = plays - rewards
  let maxSample = -Infinity;
  let bestArm = 0;
  for (let i = 0; i < arms; i++) {
    const alpha = rewards[i] + 1;
    const beta = plays[i] - rewards[i] + 1;
    // Beta distribution sample (approximate using Math.random(), replace with better sampler if needed)
    const sample = betaSample(alpha, beta);
    if (sample > maxSample) {
      maxSample = sample;
      bestArm = i;
    }
  }
  return bestArm;
}

// Simple Beta sampler using the algorithm by Johnk's method (for demo purposes)
function betaSample(alpha, beta) {
  const gammaSample = (shape) => {
    if (shape < 1) {
      // Use Johnk's algorithm for alpha < 1
      let done = false;
      let x, y;
      while (!done) {
        x = Math.pow(Math.random(), 1 / shape);
        y = Math.pow(Math.random(), 1 / (1 - shape));
        if (x + y <= 1) done = true;
      }
      return -Math.log(Math.random()) * x / (x + y);
    } else {
      // Use Marsaglia and Tsang's method for alpha >= 1
      const d = shape - 1 / 3;
      const c = 1 / Math.sqrt(9 * d);
      while (true) {
        let x = normalSample();
        let v = Math.pow(1 + c * x, 3);
        if (v > 0 && Math.log(Math.random()) < 0.5 * x * x + d - d * v + d * Math.log(v)) {
          return d * v;
        }
      }
    }
  };

  const normalSample = () => {
    // Box-Muller transform
    let u = 0, v = 0;
    while(u === 0) u = Math.random();
    while(v === 0) v = Math.random();
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
  const [plays, setPlays] = useState(Array(10).fill(0));
  const [rewards, setRewards] = useState(Array(10).fill(0));
  const [logs, setLogs] = useState([]);
  const [algorithm, setAlgorithm] = useState("epsilon");
  const [epsilon, setEpsilon] = useState(0.1);
  const [isRunning, setIsRunning] = useState(false);

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
        chosenIndex = epsilonGreedy(10, epsilon, plays, rewards);
        break;
      case "thompson":
        chosenIndex = thompsonSampling(10, plays, rewards);
        break;
      case "ucb":
        chosenIndex = ucb1(10, plays, rewards, totalPlays);
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
  };

  const reset = () => {
    setPlays(Array(10).fill(0));
    setRewards(Array(10).fill(0));
    setLogs([]);
  };

  return (
    <div style={{ maxWidth: 700, margin: "auto", padding: 20, fontFamily: "Arial, sans-serif" }}>
      <h1>Stock Selector using Multi-Armed Bandit</h1>

      <h3>Select exactly 10 stocks:</h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {STOCKS_LIST.map((stock) => (
          <button
            key={stock}
            onClick={() => toggleStock(stock)}
            style={{
              padding: "8px 12px",
              borderRadius: 5,
              border: selectedStocks.includes(stock) ? "2px solid #4caf50" : "1px solid #ccc",
              backgroundColor: selectedStocks.includes(stock) ? "#d4edda" : "#f8f9fa",
              cursor: "pointer",
            }}
            disabled={!selectedStocks.includes(stock) && selectedStocks.length >= 10}
          >
            {stock}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 20 }}>
        <label>
          Choose algorithm:{" "}
          <select value={algorithm} onChange={(e) => setAlgorithm(e.target.value)}>
            <option value="epsilon">Epsilon-Greedy</option>
            <option value="thompson">Thompson Sampling</option>
            <option value="ucb">UCB1</option>
          </select>
        </label>
      </div>

      {algorithm === "epsilon" && (
        <div style={{ marginTop: 10 }}>
          <label>
            Epsilon (exploration rate):{" "}
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={epsilon}
              onChange={(e) => setEpsilon(parseFloat(e.target.value))}
            />
          </label>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <button
          onClick={runStep}
          disabled={selectedStocks.length !== 10 || isRunning}
          style={{ padding: "10px 20px", fontSize: 16, cursor: "pointer" }}
        >
          Run One Step
        </button>

        <button
          onClick={reset}
          style={{ padding: "10px 20px", fontSize: 16, marginLeft: 10, cursor: "pointer" }}
        >
          Reset
        </button>
      </div>

      <h3 style={{ marginTop: 30 }}>Logs:</h3>
      <div style={{ maxHeight: 300, overflowY: "auto", border: "1px solid #ccc", padding: 10 }}>
        {logs.length === 0 && <p>No runs yet.</p>}
        {logs.map(({ step, chosenStock, reward, algorithm }, i) => (
          <div
            key={i}
            style={{
              borderBottom: "1px solid #eee",
              padding: "8px 0",
            }}
          >
            <strong>Step {step}:</strong> Chose <strong>{chosenStock}</strong> with reward <strong>{reward}</strong> using <em>{algorithm}</em>.
          </div>
        ))}
      </div>
    </div>
  );
}
