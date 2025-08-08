export default function Dashboard() {
  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-blue-700 p-4 text-white flex justify-between">
        <h1 className="text-lg font-bold">Dashboard Aset PDAM</h1>
      </nav>
      <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition">
          <h3 className="text-gray-600">Total Aset</h3>
          <p className="text-3xl font-bold text-blue-700">120</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition">
          <h3 className="text-gray-600">Butuh Pemeliharaan</h3>
          <p className="text-3xl font-bold text-yellow-600">15</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition">
          <h3 className="text-gray-600">Aset Kritis</h3>
          <p className="text-3xl font-bold text-red-600">4</p>
        </div>
      </div>
      <div className="p-6">
      </div>
    </main>
  );
}
