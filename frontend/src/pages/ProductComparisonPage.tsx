import { useParams } from 'react-router-dom'
import { ComparisonPage } from '@/components/comparison/ComparisonPage'

export const ProductComparisonPage = () => {
  const { productId } = useParams<{ productId: string }>()

  if (!productId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-center text-gray-500">Product ID required</p>
      </div>
    )
  }

  return <ComparisonPage productId={productId} />
}
