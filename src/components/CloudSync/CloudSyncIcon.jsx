// CloudSyncIcon.jsx
// Animated cloud sync icon — spins when connected, pulses on error.
// Props:
//   status: 'idle' | 'connecting' | 'connected' | 'error'
import styled, { keyframes, css } from 'styled-components'

const rotation = keyframes`
  0%   { transform: rotate(0deg); }
  50%  { transform: rotate(180deg); }
  100% { transform: rotate(360deg); }
`

const lines = keyframes`
  0%   { transform: translateY(-10px); }
  100% { transform: translateY(8px); }
`

const cloud = keyframes`
  0%   { cx: 20; cy: 60; r: 15; }
  50%  { cx: 50; cy: 45; r: 20; }
  100% { cx: 80; cy: 60; r: 15; }
`

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.3; }
`

const StyledWrapper = styled.div`
  .loader {
    --cloud-color: ${({ $status }) =>
      $status === 'connected'  ? '#27ae60' :
      $status === 'connecting' ? '#f5a623' :
      $status === 'error'      ? '#e74c3c' :
                                 '#aaa'};
    --arrows-color: ${({ $status }) =>
      $status === 'connected'  ? '#2ecc71' :
      $status === 'connecting' ? '#ffc86b' :
      $status === 'error'      ? '#ff8a7a' :
                                 '#ccc'};
    --time-animation: 1s;
    transform: scale(1);
    transition: filter 0.3s;
    ${({ $status }) => $status === 'error' && css`animation: ${pulse} 1s ease-in-out infinite;`}
  }

  .loader #cloud {
    width: 40px;
    height: 40px;
  }

  .loader #cloud rect {
    fill: var(--cloud-color);
    transition: fill 0.5s;
  }

  .loader #cloud g:nth-child(3) {
    transform-origin: 50% 72.8938%;
    fill: var(--arrows-color);
    filter: drop-shadow(0 0 8px black);
    ${({ $status }) => $status === 'connecting'
      ? css`animation: ${rotation} var(--time-animation) linear infinite;`
      : 'animation: none;'}
    transition: fill 0.5s;
  }

  .loader #shapes g g circle {
    animation: ${cloud} calc(var(--time-animation) * 2) linear infinite;
    ${({ $status }) => ($status !== 'connected' && $status !== 'connecting') && 'animation: none;'}
  }

  .loader #shapes g g circle:nth-child(2) {
    animation-delay: calc((var(--time-animation) * 2) / -3);
  }
  .loader #shapes g g circle:nth-child(3) {
    animation-delay: calc((var(--time-animation) * 2) / -1.5);
  }

  .loader svg #lines g line {
    stroke-width: 5;
    transform-origin: 50% 50%;
    rotate: -65deg;
    ${({ $status }) => $status === 'connected' || $status === 'connecting'
      ? css`animation: ${lines} calc(var(--time-animation) / 1.33) linear infinite;`
      : 'animation: none;'}
  }
`

function CloudSyncIcon({ status = 'idle' }) {
  return (
    <StyledWrapper $status={status}>
      <div className="loader">
        <svg id="cloud" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
          <defs>
            <filter id="roundness">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" />
              <feColorMatrix values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 20 -10" />
            </filter>
            <mask id="shapes">
              <g fill="white">
                <polygon points="50 37.5 80 75 20 75 50 37.5" />
                <circle cx={20} cy={60} r={15} />
                <circle cx={80} cy={60} r={15} />
                <g>
                  <circle cx={20} cy={60} r={15} />
                  <circle cx={20} cy={60} r={15} />
                  <circle cx={20} cy={60} r={15} />
                </g>
              </g>
            </mask>
            <mask id="clipping" clipPathUnits="userSpaceOnUse">
              <g id="lines" filter="url(#roundness)">
                <g mask="url(#shapes)" stroke="white">
                  {[-40,-31,-22,-13,-4,5,14,23,32,41,50,59,68,77,86,95,104,113,122,131,140].map(y => (
                    <line key={y} x1={-50} y1={y} x2={150} y2={y} />
                  ))}
                </g>
              </g>
            </mask>
          </defs>
          <rect x={0} y={0} width={100} height={100} rx={0} ry={0} mask="url(#clipping)" />
          <g>
            {status === 'connected' ? (
              /* Tick / checkmark — centered in the cloud */
              <path
                d="M30,68 L44,82 L72,52"
                stroke="var(--arrows-color)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                filter="drop-shadow(0 0 1px rgba(0,0,0,0.1))"
              />
            ) : (
              <>
                <path d="M33.52,68.12 C35.02,62.8 39.03,58.52 44.24,56.69 C49.26,54.93 54.68,55.61 59.04,58.4 C59.04,58.4 56.24,60.53 56.24,60.53 C55.45,61.13 55.68,62.37 56.63,62.64 C56.63,62.64 67.21,65.66 67.21,65.66 C67.98,65.88 68.75,65.3 68.74,64.5 C68.74,64.5 68.68,53.5 68.68,53.5 C68.67,52.51 67.54,51.95 66.75,52.55 C66.75,52.55 64.04,54.61 64.04,54.61 C57.88,49.79 49.73,48.4 42.25,51.03 C35.2,53.51 29.78,59.29 27.74,66.49 C27.29,68.08 28.22,69.74 29.81,70.19 C30.09,70.27 30.36,70.31 30.63,70.31 C31.94,70.31 33.14,69.44 33.52,68.12Z" />
                <path d="M69.95,74.85 C68.35,74.4 66.7,75.32 66.25,76.92 C64.74,82.24 60.73,86.51 55.52,88.35 C50.51,90.11 45.09,89.43 40.73,86.63 C40.73,86.63 43.53,84.51 43.53,84.51 C44.31,83.91 44.08,82.67 43.13,82.4 C43.13,82.4 32.55,79.38 32.55,79.38 C31.78,79.16 31.02,79.74 31.02,80.54 C31.02,80.54 31.09,91.54 31.09,91.54 C31.09,92.53 32.22,93.09 33.01,92.49 C33.01,92.49 35.72,90.43 35.72,90.43 C39.81,93.63 44.77,95.32 49.84,95.32 C52.41,95.32 55,94.89 57.51,94.01 C64.56,91.53 69.99,85.75 72.02,78.55 C72.47,76.95 71.54,75.3 69.95,74.85Z" />
              </>
            )}
          </g>
        </svg>
      </div>
    </StyledWrapper>
  )
}

export default CloudSyncIcon
