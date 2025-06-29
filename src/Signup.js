// import React, { useState } from "react";
// import { useNavigate } from "react-router-dom";

// export default function Signup() {
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [error, setError] = useState("");
//   const navigate = useNavigate();

//   const handleSubmit = (e) => {
//     e.preventDefault();
//     setError("");

//     // Basic validation
//     if (!email.includes("@")) {
//       setError("Please enter a valid email.");
//       return;
//     }
//     if (password.length < 6) {
//       setError("Password must be at least 6 characters.");
//       return;
//     }

//     // TODO: Implement actual signup logic here (e.g., Firebase, API)

//     // For now, simulate signup success with a timeout
//     setTimeout(() => {
//       // Redirect to main App page after "signup"
//       navigate("/app");
//     }, 500);
//   };

//   return (
//     <div className="signup-container">
//       <h1>Signup</h1>
//       <form onSubmit={handleSubmit} className="signup-form">
//         <label>
//           Email:
//           <input
//             type="email"
//             value={email}
//             onChange={(e) => setEmail(e.target.value)}
//             required
//             autoComplete="email"
//           />
//         </label>

//         <label>
//           Password:
//           <input
//             type="password"
//             value={password}
//             onChange={(e) => setPassword(e.target.value)}
//             required
//             autoComplete="new-password"
//           />
//         </label>

//         {error && <p className="error-message">{error}</p>}

//         <button type="submit" className="btn primary">Sign Up</button>
//       </form>
//     </div>
//   );
// }


import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Signup.css"; 

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!email.includes("@")) {
      setError("Please enter a valid email.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setTimeout(() => {
      navigate("/app");
    }, 500);
  };

  return (
    <div className="signup-page">
      <div className="signup-card">
        <h1 className="signup-title">Welcome to MABStocks</h1>
        <p className="signup-subtitle">Create your account to begin</p>

        <form onSubmit={handleSubmit} className="signup-form">
          <label>
            Email:
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>

          <label>
            Password:
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </label>

          {error && <p className="error-message">{error}</p>}

          <button type="submit" className="btn-primary">Sign Up</button>
        </form>
      </div>
    </div>
  );
}
