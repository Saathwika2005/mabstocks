import React, { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import './App.css'; // We'll update this CSS file

const API_KEY = "WUMOY4I2MWJSGM68"; // Replace with your Alpha Vantage API key

const STOCKS_LIST = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "META", "NVDA", "JPM",
  "V", "DIS", "NFLX", "ADBE", "INTC", "CSCO", "ORCL", "BAC", "WMT",
  "PG", "MA", "XOM", "KO", "PEP", "CVX", "MRK",
];

const ALGORITHM_OPTIONS = [
  { value: "ucb", label: "Long-Term Investment" },
  { value: "thompson", label: "Daily Trading" },
  { value: "epsilon", label: "Conservative Investing " },
];

// Helper to add a delay to avoid hitting API rate limits too quickly
const delay = (ms) => new Promise(res => setTimeout(res, ms));

function fetchIntradayReturn(symbol) {
  return fetch(
    `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=5min&apikey=${API_KEY}`
  )
    .then((res) => res.json())
    .then((data) => {
      console.log(`Intraday data for ${symbol}:`, data);
      const ts = data["Time Series (5min)"];
      if (!ts) {
        console.warn(`No intraday time series for ${symbol}.`);
        return 0;
      }
      const sortedTimes = Object.keys(ts).sort((a, b) => new Date(b) - new Date(a));
      const latest = ts[sortedTimes[0]];
      const earliest = ts[sortedTimes[sortedTimes.length - 1]];
      const latestPrice = parseFloat(latest["4. close"]);
      const openPrice = parseFloat(earliest["1. open"]);
      return ((latestPrice - openPrice) / openPrice) * 100;
    })
    .catch((error) => {
      console.error(`Error fetching intraday data for ${symbol}:`, error);
      return 0;
    });
}

async function fetchHistoricalData(symbol, algorithm) {
  let url;
  let dataKey;
  
  if (algorithm === 'ucb') {
    url = `https://www.alphavantage.co/query?function=TIME_SERIES_MONTHLY&symbol=${symbol}&apikey=${API_KEY}`;
    dataKey = 'Monthly Time Series';
  } else if (algorithm === 'thompson') {
    url = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=60min&apikey=${API_KEY}`;
    dataKey = 'Time Series (60min)';
  } else {
    url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${API_KEY}`;
    dataKey = 'Time Series (Daily)';
  }

  try {
    const response = await fetch(url);
    const data = await response.json();
    console.log(`Historical data for ${symbol} (${algorithm}):`, data);
    
    if (data["Error Message"] || data["Note"]) {
        console.error("Alpha Vantage API Error:", data["Error Message"] || data["Note"]);
        return [];
    }

    const timeSeries = data[dataKey];
    
    if (!timeSeries) {
        console.warn(`No time series found for ${symbol} with key "${dataKey}". Raw data:`, data);
        return [];
    }

    const entries = Object.entries(timeSeries);
    let filteredEntries;

    if (algorithm === 'ucb') {
      filteredEntries = entries.slice(0, 12); // Last 12 months
    } else if (algorithm === 'thompson') {
      filteredEntries = entries.slice(0, 24); // Last 24 hours (assuming 24 data points for 60min interval)
    } else {
      filteredEntries = entries.slice(0, 7); // Last 7 days
    }

    return filteredEntries
      .map(([date, values]) => ({
        date: algorithm === 'thompson' ? new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date(date).toLocaleDateString(),
        price: parseFloat(values['4. close']),
        fullDate: date
      }))
      .reverse();
  } catch (error) {
    console.error('Error fetching historical data:', error);
    return [];
  }
}

function epsilonGreedy(arms, epsilon, plays, rewards) {
  if (Math.random() < epsilon) {
    return Math.floor(Math.random() * arms);
  } else {
    let best = 0;
    let bestValue = -Infinity;
    for (let i = 0; i < arms; i++) {
      const avg = plays[i] ? rewards[i] / plays[i] : 0;
      if (avg > bestValue) {
        bestValue = avg;
        best = i;
      }
    }
    return best;
  }
}

function thompsonSampling(arms, plays, rewards) {
  let best = 0;
  let maxSample = -Infinity;
  for (let i = 0; i < arms; i++) {
    const n = plays[i];
    const mean = n > 0 ? rewards[i] / n : 0;
    const std = n > 0 ? 1 / Math.sqrt(n) : 1;
    const sample = mean + std * normalSample();
    if (sample > maxSample) {
      maxSample = sample;
      best = i;
    }
  }
  return best;
}

function normalSample() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function ucb1(arms, plays, rewards, totalPlays) {
  for (let i = 0; i < arms; i++) {
    if (plays[i] === 0) return i;
  }
  let best = 0;
  let bestValue = -Infinity;
  for (let i = 0; i < arms; i++) {
    const avg = rewards[i] / plays[i];
    const confidence = Math.sqrt((2 * Math.log(totalPlays)) / plays[i]);
    const value = avg + confidence;
    if (value > bestValue) {
      bestValue = value;
      best = i;
    }
  }
  return best;
}

export default function App() {
  const [selectedStocks, setSelectedStocks] = useState([]);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState("");
  const [algorithmLocked, setAlgorithmLocked] = useState(false);
  const [epsilon, setEpsilon] = useState(0.1);
  const [logs, setLogs] = useState([]);
  const [finalResults, setFinalResults] = useState({});
  const [plays, setPlays] = useState(Array(10).fill(0));
  const [rewards, setRewards] = useState(Array(10).fill(0));
  const [showHistory, setShowHistory] = useState(false);
  const [historicalData, setHistoricalData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [runningStep, setRunningStep] = useState(false);

  useEffect(() => {
    if (selectedStocks.length === 10) {
      setPlays(Array(10).fill(0));
      setRewards(Array(10).fill(0));
      setLogs([]);
      setFinalResults({});
    }
  }, [selectedStocks]);

  const toggleStock = (symbol) => {
    setSelectedStocks((prev) =>
      prev.includes(symbol)
        ? prev.filter((s) => s !== symbol)
        : prev.length < 10
        ? [...prev, symbol]
        : prev
    );
  };

  const runStep = async () => {
    if (selectedStocks.length !== 10) {
      alert("Please select exactly 10 stocks.");
      return;
    }
    
    if (!selectedAlgorithm) {
      alert("What kind of trading are you interested in?");
      return;
    }

    setRunningStep(true);
    setAlgorithmLocked(true);

    const totalPlays = plays.reduce((a, b) => a + b, 0);
    let choice;

    if (selectedAlgorithm === "epsilon") {
      choice = epsilonGreedy(10, epsilon, plays, rewards);
    } else if (selectedAlgorithm === "thompson") {
      choice = thompsonSampling(10, plays, rewards);
    } else if (selectedAlgorithm === "ucb") {
      choice = ucb1(10, plays, rewards, totalPlays || 1);
    }

    const stock = selectedStocks[choice];
    const reward = await fetchIntradayReturn(stock);
    await delay(1500); // Add a delay to respect API limits and show loading feedback

    const newPlays = [...plays];
    const newRewards = [...rewards];
    newPlays[choice]++;
    newRewards[choice] += reward;

    setPlays(newPlays);
    setRewards(newRewards);

    const algorithmLabel = ALGORITHM_OPTIONS.find(opt => opt.value === selectedAlgorithm)?.label || selectedAlgorithm;

    setLogs((prevLogs) => [
      {
        step: totalPlays + 1,
        algorithm: selectedAlgorithm,
        algorithmLabel,
        stock,
        reward,
      },
      ...prevLogs,
    ]);
    setRunningStep(false);
  };

  const showFinalResults = () => {
    if (!selectedAlgorithm) {
      alert("Please select an algorithm first.");
      return;
    }

    let best = 0;
    let bestAvg = -Infinity;
    for (let i = 0; i < 10; i++) {
      const avg = plays[i] ? rewards[i] / plays[i] : -Infinity;
      if (avg > bestAvg) {
        best = i;
        bestAvg = avg;
      }
    }

    const algorithmLabel = ALGORITHM_OPTIONS.find(opt => opt.value === selectedAlgorithm)?.label || selectedAlgorithm;
    
    setFinalResults({
      algorithm: algorithmLabel,
      stock: selectedStocks[best],
      avgReward: bestAvg.toFixed(2) + "%",
      bestStockIndex: best,
    });
  };

  const viewHistory = async () => {
    if (!finalResults.stock) {
      alert("Please show final results first to identify the best stock.");
      return;
    }

    setLoadingHistory(true);
    setShowHistory(true);
    
    try {
      const data = await fetchHistoricalData(finalResults.stock, selectedAlgorithm);
      setHistoricalData(data);
    } catch (error) {
      console.error('Error loading historical data:', error);
      alert('Error loading historical data. Please try again.');
    } finally {
      setLoadingHistory(false);
    }
  };

  const getHistoryTitle = () => {
    if (!selectedAlgorithm || !finalResults.stock) return "";
    
    const periods = {
      ucb: "Last 12 Months (Monthly)",
      thompson: "Last 24 Hours (Hourly)", 
      epsilon: "Last 7 Days (Daily)"
    };
    
    return `${finalResults.stock} Price History - ${periods[selectedAlgorithm]}`;
  };

  const reset = () => {
    setLogs([]);
    setFinalResults({});
    setPlays(Array(10).fill(0));
    setRewards(Array(10).fill(0));
    setAlgorithmLocked(false);
    setSelectedAlgorithm("");
    setEpsilon(0.1);
    setShowHistory(false);
    setHistoricalData([]);
    setLoadingHistory(false);
    setRunningStep(false);
  };

  return (
    // The 'dark-theme' class is now always applied
    <div className="app-container dark-theme">
      <h1 className="app-title">Multi-Armed Bandit Stock Selector</h1>
      
      <div className="section-card">
        <h2>Select exactly 10 Stocks:</h2>
        <div className="stocks-grid">
          {STOCKS_LIST.map((stock) => (
            <button
              key={stock}
              onClick={() => toggleStock(stock)}
              className={`stock-button ${selectedStocks.includes(stock) ? "selected" : ""}`}
              disabled={selectedStocks.length >= 10 && !selectedStocks.includes(stock)}
            >
              {stock}
            </button>
          ))}
        </div>
      </div>

      <div className="section-card">
        <h2>Select Algorithm:</h2>
        <div className="algorithm-options">
          {ALGORITHM_OPTIONS.map((option) => (
            <label key={option.value} className="radio-label">
              <input
                type="radio"
                name="algorithm"
                value={option.value}
                checked={selectedAlgorithm === option.value}
                onChange={(e) => setSelectedAlgorithm(e.target.value)}
                disabled={algorithmLocked}
              />
              {option.label}
            </label>
          ))}
        </div>

        {selectedAlgorithm === "epsilon" && (
          <div className="epsilon-slider">
            <label>
              How much would you prefer to explore (0-1): 
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={epsilon}
                onChange={(e) => setEpsilon(parseFloat(e.target.value))}
                disabled={algorithmLocked}
              />
              <span>{epsilon.toFixed(2)}</span>
            </label>
          </div>
        )}
      </div>

      <div className="action-buttons">
        <button 
          onClick={runStep} 
          disabled={selectedStocks.length !== 10 || !selectedAlgorithm || runningStep}
          className="btn primary"
        >
          {runningStep ? "Running..." : "Run Step"}
        </button>
        <button onClick={showFinalResults} className="btn secondary">
          Show Final Results
        </button>
        {finalResults.stock && (
          <button onClick={viewHistory} disabled={loadingHistory} className="btn tertiary">
            {loadingHistory ? "Loading History..." : "View History"}
          </button>
        )}
        <button onClick={reset} className="btn reset">
          Reset All
        </button>
      </div>

      {Object.keys(finalResults).length > 0 && (
        <div className="section-card final-results-card">
          <h2>Final Best Stock:</h2>
          <p>
            For {finalResults.algorithm}, the recommended stock is {finalResults.stock}, with an average return of {finalResults.avgReward}.
          </p>
        </div>
      )}

      {showHistory && (
        <div className="section-card history-chart-card">
          <h2>{getHistoryTitle()}</h2>
          {loadingHistory ? (
            <p className="loading-message">Fetching historical data for {finalResults.stock}...</p>
          ) : historicalData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={historicalData} margin={{ top: 10, right: 30, left: 20, bottom: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#555" /> {/* Darker grid lines for dark theme */}
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: '#bbb', fontSize: 12 }} // Lighter tick labels
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  tick={{ fill: '#bbb', fontSize: 12 }} // Lighter tick labels
                  label={{ value: 'Price ($)', angle: -90, position: 'insideLeft', fill: '#bbb' }} // Lighter label
                />
                <Tooltip 
                  formatter={(value) => [`$${value.toFixed(2)}`, 'Price']}
                  labelFormatter={(label) => `Date: ${label}`}
                  contentStyle={{ 
                    backgroundColor: 'rgba(40,40,40,0.9)', // Darker tooltip background
                    border: '1px solid #666', // Lighter tooltip border
                    borderRadius: '5px' 
                  }}
                  labelStyle={{ color: '#eee' }} // Lighter tooltip label
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Line 
                  type="monotone" 
                  dataKey="price" 
                  stroke="#4CAF50" 
                  strokeWidth={2}
                  dot={{ fill: '#4CAF50', strokeWidth: 2, r: 3 }}
                  activeDot={{ r: 6, strokeWidth: 2, fill: '#FFC107' }}
                  name="Stock Price"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="no-data-message">No historical data available or an error occurred while loading. Please check the console for details or try again later.</p>
          )}
        </div>
      )}

      <div className="section-card logs-card">
        <h2>Action Logs:</h2>
        <ul className="logs-list">
          {logs.length > 0 ? (
            logs.map((log, idx) => (
              <li key={idx} className="log-item">
                <span className="log-step">Step {log.step}</span> ({log.algorithmLabel}):{" "}
                Selected {log.stock} → {log.reward.toFixed(2)}% return.
              </li>
            ))
          ) : (
            <li className="no-data-message">No steps run yet. Select stocks and click "Run Step"!</li>
          )}
        </ul>
      </div>
    </div>
  );
}
