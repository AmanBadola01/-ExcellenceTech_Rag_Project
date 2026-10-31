import React, { useEffect, useRef } from "react";

interface AmbientToken {
  text: string;
  x: number;
  y: number;
  alpha: number;
}

export function AmbientBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    let mouseX = -100;
    let mouseY = -100;

    const tokens: AmbientToken[] = [
      { text: "BBOX [0.12, 0.44, 0.18, 0.68]", x: 0.14, y: 0.22, alpha: 0.45 },
      { text: "CONF_SURVEY: 0.994", x: 0.78, y: 0.16, alpha: 0.5 },
      { text: "CRAFT_NEURAL_RECOG", x: 0.86, y: 0.62, alpha: 0.4 },
      { text: "DESKEW_AFFINE: -3.04°", x: 0.07, y: 0.72, alpha: 0.45 },
      { text: "TABLE_MATRIX [3 ROWS x 4 COLS]", x: 0.72, y: 0.82, alpha: 0.4 },
      { text: "GEMINI_VISION_RECONCILE", x: 0.22, y: 0.88, alpha: 0.45 },
      { text: "TOKENS: 32 ACTIVE", x: 0.05, y: 0.42, alpha: 0.4 },
      { text: "HEX 0x4F92C • OKLCH", x: 0.91, y: 0.38, alpha: 0.35 },
    ];

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);

    const render = (time: number) => {
      ctx.clearRect(0, 0, width, height);

      // 1. Blueprint Precision Measurement Grid
      const gridSize = 64;
      ctx.strokeStyle = "rgba(75, 105, 140, 0.35)";
      ctx.lineWidth = 1;

      ctx.beginPath();
      for (let x = 0; x < width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // 2. Optical Crosshairs '+' with gentle ambient luminescence
      for (let x = 0; x < width; x += gridSize * 2) {
        for (let y = 0; y < height; y += gridSize * 2) {
          const wave = Math.sin(time * 0.0012 + x * 0.008 + y * 0.006);
          const isGlowing = wave > 0.55;

          if (isGlowing) {
            ctx.fillStyle = `rgba(182, 255, 59, ${0.45 + (wave - 0.55) * 1.5})`;
            ctx.fillRect(x - 5, y, 11, 1);
            ctx.fillRect(x, y - 5, 1, 11);
          } else {
            ctx.fillStyle = "rgba(85, 110, 145, 0.45)";
            ctx.fillRect(x - 3, y, 7, 1);
            ctx.fillRect(x, y - 3, 1, 7);
          }
        }
      }

      // 3. Render Ambient Floating OCR Telemetry Tokens with gentle drift
      ctx.font = "12px 'Geist Mono', monospace";
      for (const tok of tokens) {
        tok.y += 0.00015;
        if (tok.y > 0.95) tok.y = 0.05;

        const px = tok.x * width;
        const py = tok.y * height;

        const pulse = Math.sin(time * 0.0018 + tok.x * 10);
        const alpha = Math.max(0.4, 0.6 + pulse * 0.3);
        const color = `rgba(182, 255, 59, ${alpha})`;

        ctx.fillStyle = color;
        ctx.fillText(tok.text, px, py);

        // Delicate corner brackets
        ctx.strokeStyle = `rgba(182, 255, 59, ${alpha * 0.6})`;
        ctx.lineWidth = 1;
        const textW = ctx.measureText(tok.text).width;
        ctx.strokeRect(px - 8, py - 14, textW + 16, 20);
      }

      // 4. Interactive Mouse Coordinate Reticle Tracking
      if (mouseX > 0 && mouseY > 0) {
        ctx.strokeStyle = "rgba(182, 255, 59, 0.4)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(mouseX, mouseY, 16, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "rgba(182, 255, 59, 0.85)";
        ctx.font = "10px 'Geist Mono', monospace";
        ctx.fillText(`X:${Math.round(mouseX)} Y:${Math.round(mouseY)}`, mouseX + 22, mouseY + 4);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return <canvas id="ambientBgCanvas" ref={canvasRef} />;
}

