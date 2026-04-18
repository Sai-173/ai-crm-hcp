import React, { useState } from "react";
import { logForm } from "./api";

export default function Form() {
  const [form, setForm] = useState({
    hcp_name: "",
    date: "",
    summary: ""
  });

  const submit = async () => {
    await logForm(form);
    alert("Saved");
  };

  return (
    <div>
      <h2>Manual Form</h2>

      <input placeholder="HCP Name"
        onChange={(e) => setForm({...form, hcp_name: e.target.value})} />

      <input placeholder="Date"
        onChange={(e) => setForm({...form, date: e.target.value})} />

      <input placeholder="Summary"
        onChange={(e) => setForm({...form, summary: e.target.value})} />

      <button onClick={submit}>Submit</button>
    </div>
  );
}