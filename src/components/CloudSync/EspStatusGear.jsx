// EspStatusGear.jsx
// Spinning gear loader used to show the ESP32 hardware connection status.
// Status colours + animations:
//   idle        → slow spin (4 s), grey tint
//   connecting  → slow spin, amber tint
//   connected   → fast spin (0.8 s), green glow + sparkles (mirrors :hover)
//   error       → gears explode apart (mirrors :active), red tint

import styled, { css, keyframes } from 'styled-components'

// ─── colour map ───────────────────────────────────────────────
const COLOR = {
  idle:       '#888',
  connecting: '#f5a623',
  connected:  '#067c40',
  error:      '#e74c3c',
}

// ─── animations ───────────────────────────────────────────────
const rotateGear = keyframes`
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
`
const sparkLeft = keyframes`
  0%   { transform: translate(0, -50%) scale(1);   opacity: 1; }
  100% { transform: translate(-100px, -50%) scale(0.5); opacity: 0; }
`

// ─── styled wrapper ───────────────────────────────────────────
const StyledWrapper = styled.div`
  .container {
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    user-select: none;
  }

  .gear-wrapper {
    width: 48px;
    height: 48px;
    display: flex;
    justify-content: center;
    align-items: center;
    background: transparent;
    position: relative;
  }

  /* shadow glow under the gears */
  .gear-wrapper::before {
    content: '';
    position: absolute;
    background: ${({ $status }) => COLOR[$status] ?? COLOR.idle}88;
    height: 6px;
    width: 60%;
    top: 46px;
    border-radius: 50%;
    filter: blur(8px);
    transition: background 0.4s;
  }

  /* ── individual gears ── */
  .gear {
    position: relative;
    width: 100%;
    height: 100%;
    transition: filter 0.4s;
  }

  /* colour fill via CSS filter so we can recolour the SVG fill */
  .gear path {
    fill: ${({ $status }) => COLOR[$status] ?? COLOR.idle};
    transition: fill 0.4s;
  }

  /* layout offsets (same as original) */
  .g1 { position: relative; left: 9px; }
  .g2 { position: relative; top: -10px; }
  .g3 { position: relative; right: 9px; }

  /* ── rotation speed depends on status ── */
  .g1, .g3 {
    animation: ${rotateGear}
      ${({ $status }) => $status === 'connected' ? '0.8s' : '4s'}
      linear infinite;

    ${({ $status }) => $status === 'connected' && css`
      filter: drop-shadow(1px 1px 2px #067c40);
    `}
    ${({ $status }) => $status === 'error' && css`
      animation: none;
      transform: translateX(${({ $status }) => $status === 'error' ? '-30px' : '0'});
      transition: transform 0.4s;
    `}
  }

  .g2 {
    animation: ${rotateGear}
      ${({ $status }) => $status === 'connected' ? '0.8s' : '4s'}
      linear infinite reverse;

    ${({ $status }) => $status === 'connected' && css`
      filter: drop-shadow(1px 1px 2px #067c40);
    `}
    ${({ $status }) => $status === 'error' && css`
      animation: none;
      transform: translateY(-30px);
      transition: transform 0.4s;
    `}
  }

  /* fix: error state — override g1/g3 translateX */
  ${({ $status }) => $status === 'error' && css`
    .g1 { animation: none; transform: translateX(-30px); transition: transform 0.4s; }
    .g3 { animation: none; transform: translateX(30px);  transition: transform 0.4s; }
    .g2 { animation: none; transform: translateY(-30px); transition: transform 0.4s; }
  `}

  /* ── sparkles — only shown when connected ── */
  .spark {
    position: absolute;
    width: 4px;
    height: 4px;
    background: #067c40;
    border-radius: 50%;
    pointer-events: none;
    opacity: ${({ $status }) => $status === 'connected' ? '1' : '0'};
  }

  .spark:nth-child(1) { top: 0%;  left: 50%; }
  .spark:nth-child(2) { top: 20%; left: 50%; }
  .spark:nth-child(3) { top: 35%; left: 50%; }

  ${({ $status }) => $status === 'connected' && css`
    .spark {
      animation: ${sparkLeft} 0.4s ease-out forwards infinite;
    }
  `}

  /* ── status label below the gears ── */
  .esp-label {
    font-size: 0.45rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-top: 4px;
    color: ${({ $status }) => COLOR[$status] ?? COLOR.idle};
    transition: color 0.4s;
  }
`

// ─── shared SVG path (same gear shape for all three) ──────────
const GEAR_PATH = "M5664 11538 c-38 -40 -55 -68 -68 -113 -19 -65 -44 -149 -70 -235 -9-30 -74 -248 -145 -484 l-128 -429 -97 -33 c-176 -60 -334 -125 -503 -209l-168 -83 -100 53 c-55 29 -154 82 -220 117 -66 36 -147 80 -180 98 -232 125-441 239 -505 275 -41 22 -100 54 -131 70 l-57 29 -108 -101 c-60 -56 -315-308 -568 -561 l-458 -460 54 -98 c30 -55 77 -139 103 -189 26 -49 62 -115 78-145 17 -30 57 -103 89 -162 32 -60 86 -159 119 -220 34 -62 84 -156 112 -20827 -52 56 -104 63 -115 8 -11 14 -26 14 -35 0 -8 -31 -76 -69 -150 -90 -176-178 -385 -247 -587 -18 -50 -20 -52 -74 -68 -30 -10 -73 -23 -95 -30 -34 -11-101 -31 -140 -41 -5 -2 -41 -12 -80 -24 -38 -12 -77 -23 -85 -25 -8 -2 -46-13 -85 -25 -38 -12 -77 -23 -85 -25 -8 -2 -69 -20 -135 -40 -177 -53 -269-81 -370 -110 -82 -24 -95 -31 -147 -83 l-57 -57 -1 -712 c0 -688 0 -713 19-722 10 -6 56 -21 102 -35 46 -13 170 -50 274 -81 105 -31 197 -58 205 -60 8-2 47 -14 85 -25 111 -34 154 -47 245 -73 113 -33 287 -85 326 -98 27 -8 34-18 49 -67 79 -263 165 -482 275 -702 l68 -136 -52 -100 c-29 -54 -81 -151-116 -214 -34 -63 -79 -146 -100 -185 -21 -38 -65 -119 -97 -180 -97 -177-187 -344 -236 -436 l-46 -85 510 -510 509 -509 58 29 c31 17 91 49 132 71 8246 409 224 535 291 44 24 134 72 200 109 66 36 152 82 191 102 l71 36 179 -90c98 -50 240 -114 314 -143 74 -29 144 -56 155 -61 18 -7 175 -57 231 -74 14-3 25 -19 32 -43 18 -63 66 -228 112 -377 11 -38 23 -77 25 -85 3 -13 70 -240139 -470 13 -41 40 -132 61 -203 l38 -127 723 0 723 0 55 66 c31 36 56 68 5772 1 13 8 37 29 107 12 39 23 77 25 85 2 8 13 47 25 85 12 39 23 77 25 85 2 813 44 24 80 11 36 63 211 116 390 53 179 100 332 105 340 4 8 48 28 97 44 15650 363 137 548 229 l180 90 55 -29 c30 -16 118 -63 195 -105 125 -68 203 -110445 -241 36 -20 119 -65 185 -100 66 -36 159 -86 206 -111 47 -26 92 -47 101-47 18 0 1118 1103 1118 1122 0 7 -12 33 -26 58 -14 25 -45 81 -69 125 -23 44-71 132 -105 195 -35 63 -138 255 -230 426 -93 170 -177 326 -189 345 -11 19-21 41 -21 50 0 9 27 69 60 133 53 104 109 230 156 351 9 22 19 47 23 55 4 825 69 46 135 21 66 43 125 49 132 6 6 52 23 101 38 148 44 177 52 250 75 3911 77 23 85 25 8 2 47 13 85 25 39 12 77 23 85 25 8 2 47 13 85 25 39 12 7723 85 25 8 2 69 20 135 40 66 20 158 47 204 60 74 21 91 30 138 77 l53 52 0722 0 722 -62 21 c-59 19 -325 98 -358 106 -8 2 -46 14 -85 25 -105 32 -15146 -250 75 -49 15 -126 37 -170 50 -44 13 -118 35 -165 49 -47 13 -114 33-150 45 l-65 20 -34 103 c-67 211 -195 507 -293 684 l-45 80 80 145 c43 79 99182 124 229 57 106 223 413 360 665 24 44 51 95 60 113 l17 33 -499 499 c-275275 -507 500 -515 500 -9 0 -24 -6 -35 -13 -11 -8 -58 -34 -105 -59 -90 -48-253 -136 -447 -242 -65 -35 -145 -78 -178 -96 -92 -49 -169 -91 -302 -164l-121 -66 -159 79 c-192 96 -331 153 -523 216 -80 26 -154 51 -166 55 -15 6-26 29 -43 86 -33 117 -60 207 -161 544 -51 168 -102 341 -115 385 -13 44 -33112 -45 150 -12 39 -23 78 -25 88 -2 9 -7 22 -10 27 -4 7 -260 10 -729 10l-723 0 -49 -52z m981 -3342 c83 -16 89 -17 166 -35 248 -57 582 -231 789-413 344 -302 557 -671 644 -1118 23 -119 27 -176 27 -362 0 -163 -9 -263 -30-361 -6 -23 -13 -58 -16 -77 -13 -77 -89 -282 -150 -405 -178 -362 -407 -601-735 -767 -355 -180 -750 -252 -1120 -203 -63 8 -126 17 -140 20 -14 3 -47 10-75 16 -91 18 -310 97 -423 154 -560 280 -966 827 -1058 1425 -30 198 -30 5011 650 3 14 8 41 11 60 31 174 128 426 228 593 120 200 230 324 406 456 216163 515 302 745 346 73 14 203 35 240 39 83 9 412 -4 490 -18z"

function GearSvg({ className }) {
  return (
    <svg
      className={`gear ${className}`}
      preserveAspectRatio="xMidYMid meet"
      viewBox="0 0 1280 1280"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="translate(0,1280) scale(0.1,-0.1)">
        <path d={GEAR_PATH} />
      </g>
    </svg>
  )
}

// ─── main component ───────────────────────────────────────────
function EspStatusGear({ status = 'idle' }) {
  const label = {
    idle:       'ESP –',
    connecting: 'ESP …',
    connected:  'ESP ✓',
    error:      'ESP ✗',
  }[status] ?? 'ESP –'

  return (
    <StyledWrapper $status={status}>
      <div className="container">
        <div className="gear-wrapper">
          <span className="spark" />
          <span className="spark" />
          <span className="spark" />
          <GearSvg className="g1" />
          <GearSvg className="g2" />
          <GearSvg className="g3" />
        </div>
        <div className="esp-label">{label}</div>
      </div>
    </StyledWrapper>
  )
}

export default EspStatusGear
