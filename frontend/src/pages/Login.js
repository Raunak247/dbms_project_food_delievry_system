import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { API_BASE_URL } from "../api";

export default function Login({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const submit = async () => {
    try {
      if (isRegister) {
        const { data } = await api.post("/api/auth/register", { name, email, password });
        onLogin(data.user, data.token);
        navigate("/dashboard");
        return;
      }

      const { data } = await api.post("/api/auth/login", { email, password });
      onLogin(data.user, data.token);
      navigate("/dashboard");
    } catch (error) {
      const text = error?.response?.data?.message || "Request failed";
      setMessage(text);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>{isRegister ? "Create Account" : "Login"}</h2>
        {isRegister ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
          />
        ) : null}
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
        />
        <button onClick={submit}>{isRegister ? "Register" : "Login"}</button>
        {!isRegister ? (
          <button
            type="button"
            onClick={() => {
              window.location.href = `${API_BASE_URL}/api/auth/oauth/google`;
            }}
          >
            Continue with Google
          </button>
        ) : null}
        <p className="switch-link" onClick={() => setIsRegister((p) => !p)}>
          {isRegister ? "Already have an account? Login" : "New user? Register"}
        </p>
        {message ? <p className="message">{message}</p> : null}
      </div>
    </div>
  );
}
