"use client";

const HelpPanel = ({ onClose }: { onClose: () => void }) => {
    return (
        <div style={{
            position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
            background: "rgba(0,0,0,0.5)", zIndex: 9999,
            display: "flex", justifyContent: "center", alignItems: "center",
        }}>
            <div style={{
                background: "#fff", color: "#000", padding: 24, borderRadius: 12,
                boxShadow: "0 10px 25px rgba(0,0,0,0.2)", width: 400, maxWidth: "90%",
                fontFamily: "sans-serif"
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid #eee", paddingBottom: 12 }}>
                    <h2 style={{ margin: 0, fontSize: 18 }}>💡 회로 시뮬레이터 도움말</h2>
                    <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer" }}>✕</button>
                </div>
                
                <ul style={{ paddingLeft: 20, margin: 0, lineHeight: 1.8, fontSize: 14 }}>
                    <li><b>메뉴 열기</b>: 빈 화면이나 선, 부품을 우클릭하세요. 부품을 추가하거나 삭제할 수 있습니다.</li>
                    <li><b>선 연결 (클릭)</b>: 부품의 빨간 터미널을 클릭 후 다른 위치를 클릭해 선을 그리고, 다른 터미널을 클릭해 완성하세요.</li>
                    <li><b>선 연결 (드래그)</b>: 부품 터미널을 누른 채로 드래그하여 연결할 수 있습니다. (드래그 중 Shift+클릭으로 꺾임점을 추가할 수 있습니다.)</li>
                    <li><b>자동 연결</b>: 선을 그리다가 기존 선 위에 놓으면 자동으로 노드가 생성되며 연결됩니다.</li>
                    <li><b>부품 회전</b>: 부품 근처에 마우스를 두고 <code>R</code> 키를 누르면 90도 회전합니다.</li>
                    <li><b>속성 편집</b>: 부품 몸체(네모 박스)를 좌클릭하면 우측에 속성(전압, 저항) 편집 패널이 열립니다.</li>
                    <li><b>화면 제어</b>: 마우스 휠로 확대/축소하고, 빈 공간을 드래그하여 화면을 이동(패닝)하세요.</li>
                    <li><b>작업 취소</b>: 선을 그리다가 취소하려면 <code>ESC</code> 키나 <code>우클릭</code>을 누르세요.</li>
                </ul>

                <button onClick={onClose} style={{
                    width: "100%", marginTop: 20, padding: "10px 0",
                    background: "#3b82f6", color: "#fff", border: "none",
                    borderRadius: 6, fontSize: 14, cursor: "pointer", fontWeight: "bold"
                }}>
                    확인
                </button>
            </div>
        </div>
    );
};

export default HelpPanel;
