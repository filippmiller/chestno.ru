type MadeInRussiaStampProps = {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: { width: 'w-16', height: 'h-20', text: 'text-[8px]' },
  md: { width: 'w-20', height: 'h-24', text: 'text-[10px]' },
  lg: { width: 'w-28', height: 'h-32', text: 'text-xs' },
}

export const MadeInRussiaStamp = ({ className = '', size = 'md' }: MadeInRussiaStampProps) => {
  const sizeClass = sizeClasses[size]

  return (
    <div
      className={`relative ${sizeClass.width} ${sizeClass.height} ${className} shadow-xl transition-transform hover:rotate-3 -rotate-12 overflow-hidden`}
      style={{
        background: 'linear-gradient(to bottom, #FFFFFF 0%, #FFFFFF 33.33%, #0039A6 33.33%, #0039A6 66.66%, #D52B1E 66.66%, #D52B1E 100%)',
        clipPath: 'polygon(8% 0%, 92% 0%, 100% 8%, 100% 92%, 92% 100%, 8% 100%, 0% 92%, 0% 8%)',
        WebkitClipPath: 'polygon(8% 0%, 92% 0%, 100% 8%, 100% 92%, 92% 100%, 8% 100%, 0% 92%, 0% 8%)',
        border: '2px dashed rgba(220, 38, 38, 0.6)',
      }}
    >
      {/* Текст поверх флага */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`${sizeClass.text} font-extrabold text-white leading-tight text-center px-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]`}>
          MADE<br />IN<br />RUSSIA
        </span>
      </div>
    </div>
  )
}

