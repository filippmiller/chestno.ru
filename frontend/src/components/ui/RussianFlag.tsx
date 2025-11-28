export const RussianFlag = ({ className = 'w-6 h-4' }: { className?: string }) => {
  return (
    <svg
      className={className}
      viewBox="0 0 900 600"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Флаг России"
    >
      <rect width="900" height="200" fill="#FFFFFF" />
      <rect y="200" width="900" height="200" fill="#0039A6" />
      <rect y="400" width="900" height="200" fill="#D52B1E" />
    </svg>
  )
}

