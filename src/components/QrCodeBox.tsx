import { QRCodeSVG } from 'qrcode.react'
import './QrCodeBox.css'

interface QrCodeBoxProps {
	payload: string
	segundosRestantes: number
}

export default function QrCodeBox({ payload, segundosRestantes }: QrCodeBoxProps) {
	return (
		<div className="qr-code-box">
			<div className="qr-code-box__image">
				<QRCodeSVG value={payload} size={224} level="M" includeMargin title="QR Code temporário da chamada" />
			</div>
			<div className="qr-code-box__timer" aria-live="polite">
				<span className="qr-code-box__indicator" />
				Novo código em <strong>{segundosRestantes}s</strong>
			</div>
		</div>
	)
}