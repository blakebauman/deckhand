/** Compact runtime marks for the sidebar mode switcher. */

/**
 * Docker's whale mark. The artwork is 38x30, so `size` sets the height and the
 * width follows the aspect ratio — forcing it square would squash the whale.
 * Runs a little larger than the other marks because it is short and wide, so
 * matching heights would make it read as the smallest of the three.
 */
export function DockerMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={(size * 38) / 30}
      height={size}
      viewBox="0 0 38 30"
      fill="currentColor"
      fillRule="nonzero"
      aria-hidden
    >
      <path d="M37.413,12.315c-0.933,-0.627 -3.382,-0.896 -5.163,-0.415c-0.097,-1.774 -1.012,-3.27 -2.685,-4.573l-0.619,-0.416l-0.414,0.624c-0.811,1.232 -1.153,2.873 -1.032,4.366c0.095,0.92 0.415,1.953 1.032,2.703c-2.318,1.345 -4.455,1.039 -13.919,1.039l-14.61,0c-0.042,2.137 0.302,6.248 2.915,9.593c0.289,0.37 0.604,0.727 0.948,1.072c2.126,2.128 5.336,3.689 10.138,3.693c7.325,0.007 13.601,-3.953 17.419,-13.527c1.257,0.02 4.572,0.225 6.195,-2.911c0.039,-0.052 0.413,-0.831 0.413,-0.831l-0.618,-0.415l0,-0.002Zm-27.875,-1.953l-4.108,0l-0,4.108l4.108,0l0,-4.108Zm5.308,0l-4.108,0l-0,4.108l4.108,0l0,-4.108Zm5.308,0l-4.108,0l-0,4.108l4.108,0l0,-4.108Zm5.308,0l-4.108,0l-0,4.108l4.108,0l0,-4.108Zm-21.232,0l-4.108,0l-0,4.108l4.108,0l0,-4.108Zm5.308,-5.19l-4.108,-0l-0,4.108l4.108,0l0,-4.108Zm5.308,-0l-4.108,-0l-0,4.108l4.108,0l0,-4.108Zm5.308,-0l-4.108,-0l-0,4.108l4.108,0l0,-4.108Zm0,-5.19l-4.108,0l-0,4.109l4.108,-0l0,-4.109Z" />
    </svg>
  );
}

/**
 * Kubernetes' helm mark: a point-up heptagon around a seven-spoked ship's
 * wheel. The geometry is computed rather than eyeballed — vertices and spokes
 * sit at exact 360/7 intervals — so the seven-fold symmetry is true.
 *
 * Runs larger than the old glyph to sit alongside the Docker whale; both are
 * sized from the mode list rather than the shared default.
 */
export function KubernetesMark({ size = 21 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M12.0,1.8L19.97,5.64L21.94,14.27L16.43,21.19L7.57,21.19L2.06,14.27L4.03,5.64Z" />
      <path
        d="M12.0,9.3L14.11,10.32L14.63,12.6L13.17,14.43L10.83,14.43L9.37,12.6L9.89,10.32Z"
        fill="currentColor"
        stroke="none"
      />
      <path
        d="M12.0,9.0L12.0,4.5 M14.35,10.13L17.86,7.32 M14.92,12.67L19.31,13.67 M13.3,14.7L15.25,18.76 M10.7,14.7L8.75,18.76 M9.08,12.67L4.69,13.67 M9.65,10.13L6.14,7.32"
        strokeWidth="1.3"
      />
    </svg>
  );
}

export function MicroVMMark({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3.5" y="5" width="17" height="12" rx="2" />
      <path d="M8 20h8M12 17v3" />
    </svg>
  );
}
