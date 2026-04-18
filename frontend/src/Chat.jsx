import React, { useState } from "react";
import { sendChat } from "./api";

export default function Chat() {
  const [msg, setMsg] = useState("");
  const [res, setRes] = useState("");

  const send = async () => {
    const r = await sendChat(msg);
    setRes(JSON.stringify(r.data));
  };

  return (
    <div>
      <h2>AI Chat</h2>
      <input value={msg} onChange={(e) => setMsg(e.target.value)} />
      <button onClick={send}>Send</button>
      <pre>{res}</pre>
    </div>
  );
}