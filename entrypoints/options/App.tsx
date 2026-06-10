// entrypoints/options/App.tsx

import { useState, useEffect } from "react";
import { getApiKey, setApiKey, getRequireAltKey, setRequireAltKey, getAutoSpeak, setAutoSpeak } from "../../utils/storage";

export function App() {
  const [apiKey, setApiKeyState] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [requireAlt, setRequireAlt] = useState(true);
  const [autoSpeak, setAutoSpeakState] = useState(false);

  useEffect(() => {
    Promise.all([getApiKey(), getRequireAltKey(), getAutoSpeak()]).then(([key, alt, speak]) => {
      if (key) setApiKeyState(key);
      setRequireAlt(alt);
      setAutoSpeakState(speak);
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    const trimmed = apiKey.trim();
    await setApiKey(trimmed);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const containerStyle: React.CSSProperties = {
    maxWidth: "480px",
    margin: "40px auto",
    padding: "24px",
  };

  const headingStyle: React.CSSProperties = {
    fontSize: "20px",
    fontWeight: 600,
    marginBottom: "8px",
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: "14px",
    color: "#64748b",
    marginBottom: "24px",
    lineHeight: 1.6,
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "13px",
    fontWeight: 500,
    marginBottom: "6px",
    color: "#475569",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    fontSize: "14px",
    outline: "none",
    fontFamily: "monospace",
    transition: "border-color 0.15s",
  };

  const buttonStyle: React.CSSProperties = {
    marginTop: "12px",
    padding: "8px 20px",
    background: saved ? "#22c55e" : "#3b82f6",
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "background 0.15s",
  };

  const hintStyle: React.CSSProperties = {
    fontSize: "12px",
    color: "#94a3b8",
    marginTop: "16px",
    lineHeight: 1.6,
  };

  const linkStyle: React.CSSProperties = {
    color: "#3b82f6",
    textDecoration: "none",
  };

  if (loading) {
    return <div style={containerStyle}>加载中...</div>;
  }

  return (
    <div style={containerStyle}>
      <h1 style={headingStyle}>Lingo 设置</h1>
      <p style={subtitleStyle}>
        配置 DeepSeek API Key 以启用单词释义功能。Key
        将安全存储在你的浏览器中。
      </p>

      <label style={labelStyle} htmlFor="apikey">
        DeepSeek API Key
      </label>
      <input
        id="apikey"
        type="password"
        value={apiKey}
        onChange={(e) => setApiKeyState(e.target.value)}
        placeholder="sk-..."
        style={inputStyle}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "#3b82f6";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "#cbd5e1";
        }}
      />

      <button onClick={handleSave} style={buttonStyle}>
        {saved ? "✓ 已保存" : "保存"}
      </button>

      <h2 style={{ ...headingStyle, fontSize: "16px", marginTop: "32px" }}>
        偏好设置
      </h2>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <input
          type="checkbox"
          checked={requireAlt}
          onChange={async (e) => {
            const checked = e.target.checked;
            setRequireAlt(checked);
            await setRequireAltKey(checked);
          }}
          style={{ width: "16px", height: "16px", cursor: "pointer" }}
        />
        <span style={{ fontSize: "14px", color: "#1e293b" }}>
          需要按住 Option (Alt) 键点击单词
        </span>
      </label>
      <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: "6px", marginLeft: "26px", lineHeight: 1.5 }}>
        关闭后，直接点击页面上的单词即可查词。
      </p>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          cursor: "pointer",
          userSelect: "none",
          marginTop: "16px",
        }}
      >
        <input
          type="checkbox"
          checked={autoSpeak}
          onChange={async (e) => {
            const checked = e.target.checked;
            setAutoSpeakState(checked);
            await setAutoSpeak(checked);
          }}
          style={{ width: "16px", height: "16px", cursor: "pointer" }}
        />
        <span style={{ fontSize: "14px", color: "#1e293b" }}>
          查出单词后自动朗读发音
        </span>
      </label>
      <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: "6px", marginLeft: "26px", lineHeight: 1.5 }}>
        开启后，查词时自动朗读单词。
      </p>

      <p style={hintStyle}>
        还没有 API Key？前往{" "}
        <a
          href="https://platform.deepseek.com/api_keys"
          target="_blank"
          rel="noopener noreferrer"
          style={linkStyle}
        >
          DeepSeek 开放平台
        </a>{" "}
        创建。
      </p>
    </div>
  );
}
