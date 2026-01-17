"use client";

import { useEffect } from "react";

export default function PrintTrigger() {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.print();
    }, 200);

    return () => window.clearTimeout(timer);
  }, []);

  const handleClick = () => {
    window.print();
  };

  return (
    <button className="secondary-button" type="button" onClick={handleClick}>
      Open print dialog
    </button>
  );
}
