import { useEffect } from 'react'

interface ComparisonSeoProps {
  productName: string
  productCount: number
}

export const ComparisonSeo = ({ productName, productCount }: ComparisonSeoProps) => {
  const title = `Compare ${productName} with ${productCount} alternatives | Chestno.ru`

  useEffect(() => {
    document.title = title
  }, [title])

  return null
}
