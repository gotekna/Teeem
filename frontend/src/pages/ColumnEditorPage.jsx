import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import ColumnEditorFullView from '../components/schema/ColumnEditorFullView'

export default function ColumnEditorPage() {
  const { tableId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const tableName = searchParams.get('name') || 'Table'

  // Check if we're in "new" mode by looking at the URL path
  const isNewMode = location.pathname.endsWith('/new')

  const handleClose = () => {
    // Navigate back to the previous page or settings
    navigate(-1)
  }

  return (
    <ColumnEditorFullView
      tableId={parseInt(tableId)}
      tableName={tableName}
      onClose={handleClose}
      isNewMode={isNewMode}
    />
  )
}
