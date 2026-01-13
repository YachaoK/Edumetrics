import './App.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { UploadProvider } from './context/UploadContext'
import UploadPage from './pages/UploadPage'
import AnalysisPage from './pages/AnalysisPage'

function App() {
  return (
    <UploadProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </UploadProvider>
  )
}

export default App
