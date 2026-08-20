import React, { useState, useContext } from 'react';
import { DataContext } from '../contexts/DataContext';





import { FileText, Download, FileSpreadsheet, Printer, Calendar, Filter } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { formatCurrency } from '../utils/currency';
import { sanitizeText, sanitizeNumber } from '../utils/displayValue';

export default function ReportsCenter() {
  const { materials = [], categories = [], transactions = [], suppliers = [], employees = [], transfers = [], disposals = [] } = useContext(DataContext) || {};
  const [activeReport, setActiveReport] = useState('CURRENT_STOCK');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  const [searchTerm, setSearchTerm] = useState('');
const [typeFilter, setTypeFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20; // rows per page

  const reportTypes = [
    { id: 'CURRENT_STOCK',     name: '1. Current Stock Report' },
    { id: 'STOCK_IN',          name: '2. Stock In (Receiving) Report' },
    { id: 'STOCK_OUT',         name: '3. Stock Out (Issue) Report' },
    { id: 'RETURNS',           name: '4. Returns Report' },
    { id: 'ADJUSTMENTS',       name: '5. Adjustments Report' },
    { id: 'MATERIAL_BALANCE',  name: '6. Material Balance Report' },
    { id: 'LOW_STOCK',         name: '7. Low Stock Alert Report' },
    { id: 'TRANSFERS',         name: '8. Transfers Report' },
    { id: 'DISPOSALS',         name: '9. Disposals Report' },
    { id: 'EMPLOYEE_ISSUE',    name: '10. Employee Issue Report' },
    { id: 'DEPT_CONSUMPTION',  name: '11. Department Consumption Report' },
    { id: 'SUPPLIER_REPORT',   name: '12. Supplier Summary Report' },
    { id: 'TRANSACTION_HISTORY', name: '13. Full Transaction History' }
  ];

  // Filter materials based on category
  const filteredMaterials = materials.filter(m => selectedCategory === 'ALL' || m.category_id == selectedCategory || m.category_name === selectedCategory);

  // Filter transactions by date range
  const filteredTransactions = transactions.filter(t => {
    const d = t.transaction_date ? new Date(t.transaction_date) : null;
    if (dateFrom && d && d < new Date(dateFrom)) return false;
    if (dateTo   && d && d > new Date(dateTo + 'T23:59:59')) return false;
    return true;
  });

  // Generate Report Data
  const getReportData = () => {
    switch (activeReport) {
      case 'CURRENT_STOCK':
        return filteredMaterials.map(m => ({
          'Material Code': sanitizeText(m.material_code, 'N/A'),
          'Material Name': sanitizeText(m.name, 'Unknown'),
          'Category': sanitizeText(m.category_name, 'N/A'),
          'Current Stock': sanitizeNumber(m.current_stock),
          'UOM': sanitizeText(m.unit_of_measure, 'N/A'),
          'Unit Cost (Birr)': formatCurrency(sanitizeNumber(m.unit_cost)),
          'Total Valuation (Birr)': formatCurrency(sanitizeNumber(m.current_stock) * sanitizeNumber(m.unit_cost)),
          'Store Location': sanitizeText(m.location, 'N/A')
        }));

      case 'STOCK_IN':
        return filteredTransactions
          .filter(t => t.transaction_type === 'STOCK_IN')
          .map(t => ({
            'Tx Code': t.transaction_code,
            'Material Code': t.material_code,
            'Material Name': t.material_name,
            'Quantity In': sanitizeNumber(t.quantity),
            'Unit Cost (Birr)': formatCurrency(sanitizeNumber(t.unit_cost)),
            'Total Cost (Birr)': formatCurrency(sanitizeNumber(t.unit_cost) * sanitizeNumber(t.quantity)),
            'Payment Method': sanitizeText(t.payment_method, 'Cash'),
            'Supplier': sanitizeText(t.supplier_name, 'N/A'),
            'Purpose': sanitizeText(t.purpose, 'Procurement'),
            'Received By': sanitizeText(t.issued_by_name, 'Storekeeper'),
            'Date': new Date(t.transaction_date).toLocaleDateString()
          }));

      case 'STOCK_OUT':
        return filteredTransactions
          .filter(t => t.transaction_type === 'STOCK_OUT')
          .map(t => ({
            'Tx Code': t.transaction_code,
            'Material Code': t.material_code,
            'Material Name': t.material_name,
            'Quantity Issued': sanitizeNumber(t.quantity),
            'Issued To': sanitizeText(t.receiver_name, 'Department'),
            'Purpose': sanitizeText(t.purpose, 'Issue request'),
            'Issued By': sanitizeText(t.issued_by_name, 'Storekeeper'),
            'Date': new Date(t.transaction_date).toLocaleDateString()
          }));

      case 'RETURNS':
        return filteredTransactions
          .filter(t => t.transaction_type === 'RETURN')
          .map(t => ({
            'Tx Code': t.transaction_code,
            'Material Code': t.material_code,
            'Material Name': t.material_name,
            'Quantity Returned': sanitizeNumber(t.quantity),
            'Returned By': sanitizeText(t.receiver_name, 'Employee/Dept'),
            'Remarks': sanitizeText(t.remarks || t.purpose, 'Return'),
            'Recorded By': sanitizeText(t.issued_by_name, 'Storekeeper'),
            'Date': new Date(t.transaction_date).toLocaleDateString()
          }));

      case 'ADJUSTMENTS':
        return filteredTransactions
          .filter(t => t.transaction_type === 'ADJUSTMENT')
          .map(t => ({
            'Tx Code': t.transaction_code,
            'Material Code': t.material_code,
            'Material Name': t.material_name,
            'Adjustment Qty': t.quantity,
            'Audit Note': sanitizeText(t.purpose, '—'),
            'Adjusted By': sanitizeText(t.issued_by_name, 'Storekeeper'),
            'Date': new Date(t.transaction_date).toLocaleDateString()
          }));

      case 'MATERIAL_BALANCE':
        return filteredMaterials.map(m => {
          const totalIn = filteredTransactions.filter(t => t.material_id == m.id && t.transaction_type === 'STOCK_IN').reduce((acc, curr) => acc + curr.quantity, 0);
          const totalOut = filteredTransactions.filter(t => t.material_id == m.id && t.transaction_type === 'STOCK_OUT').reduce((acc, curr) => acc + curr.quantity, 0);
          return {
            'Material Code': m.material_code,
            'Material Name': m.name,
            'Total Received': totalIn,
            'Total Issued': totalOut,
            'Remaining Stock': sanitizeNumber(m.current_stock),
            'Unit Cost (Birr)': formatCurrency(sanitizeNumber(m.unit_cost)),
            'Valuation (Birr)': formatCurrency(sanitizeNumber(m.current_stock) * sanitizeNumber(m.unit_cost))
          };
        });

      case 'LOW_STOCK':
        return filteredMaterials
          .filter(m => m.current_stock <= m.min_stock_level)
          .map(m => ({
            'Material Code': m.material_code,
            'Material Name': m.name,
            'Category': sanitizeText(m.category_name, 'N/A'),
            'Current Stock': sanitizeNumber(m.current_stock),
            'Min Threshold': sanitizeNumber(m.min_stock_level),
            'Shortage Qty': Math.max(0, sanitizeNumber(m.min_stock_level) - sanitizeNumber(m.current_stock)),
            'Supplier': sanitizeText(m.supplier_name, 'N/A')
          }));

      case 'EMPLOYEE_ISSUE':
        return employees.map(emp => {
          const issuedItems = filteredTransactions.filter(t => t.employee_dept_id == emp.id && t.transaction_type === 'STOCK_OUT');
          const totalQty = issuedItems.reduce((acc, curr) => acc + curr.quantity, 0);
          return {
            'Recipient Code': emp.code,
            'Name': emp.name,
            'Type': emp.type,
            'Department': sanitizeText(emp.department_name, 'Unassigned'),
            'Total Transactions': issuedItems.length,
            'Total Items Issued': totalQty,
            'Contact': sanitizeText(emp.contact_number, 'Contact pending')
          };
        });

      case 'DEPT_CONSUMPTION': {
        // Aggregate stock-out by department_name
        const deptMap = {};
        filteredTransactions
          .filter(t => t.transaction_type === 'STOCK_OUT')
          .forEach(t => {
            const emp = employees.find(e => e.id == t.employee_dept_id);
            const dept = emp?.department_name || sanitizeText(t.receiver_name, 'Unknown');
            if (!deptMap[dept]) deptMap[dept] = { transactions: 0, totalQty: 0, totalValue: 0 };
            deptMap[dept].transactions += 1;
            deptMap[dept].totalQty    += sanitizeNumber(t.quantity);
            deptMap[dept].totalValue  += sanitizeNumber(t.quantity) * sanitizeNumber(t.unit_cost);
          });
        return Object.entries(deptMap)
          .sort((a, b) => b[1].totalQty - a[1].totalQty)
          .map(([dept, d]) => ({
            'Department': dept,
            'Total Transactions': d.transactions,
            'Total Qty Consumed': d.totalQty,
            'Total Value (Birr)': formatCurrency(d.totalValue),
          }));
      }

      case 'TRANSFERS': {
        return transfers.map(t => ({
          'Transfer Code': t.transfer_code,
          'Material': sanitizeText(t.material_name, '—'),
          'Material Code': t.material_code,
          'Quantity': sanitizeNumber(t.quantity),
          'From Location': t.source_location,
          'To Location': t.destination_location,
          'Transferred By': sanitizeText(t.transferred_by_name, '—'),
          'Remarks': sanitizeText(t.remarks, '—'),
          'Date': t.transfer_date ? new Date(t.transfer_date).toLocaleDateString() : '—'
        }));
      }

      case 'DISPOSALS': {
        return disposals.map(d => ({
          'Disposal Code': d.disposal_code,
          'Material': sanitizeText(d.material_name, '—'),
          'Material Code': d.material_code,
          'Quantity': sanitizeNumber(d.quantity),
          'Type': sanitizeText(d.disposal_type, '—'),
          'Reason': sanitizeText(d.reason, '—'),
          'Status': d.status,
          'Recorded By': sanitizeText(d.recorder_name, '—'),
          'Approved By': sanitizeText(d.approver_name, '—'),
          'Date': d.disposal_date ? new Date(d.disposal_date).toLocaleDateString() : '—'
        }));
      }

      case 'SUPPLIER_REPORT':
        return suppliers.map(sup => {
          const suppliedMats = materials.filter(m => m.supplier_id == sup.id);
          return {
            'Supplier Code': sup.supplier_code,
            'Company Name': sanitizeText(sup.name, 'Unnamed supplier'),
            'Contact Person': sanitizeText(sup.contact_person, 'Contact pending'),
            'Email': sanitizeText(sup.email, 'Email pending'),
            'Phone': sanitizeText(sup.phone, 'Phone pending'),
            'Materials Supplied Count': suppliedMats.length
          };
        });

      case 'TRANSACTION_HISTORY':
        return filteredTransactions.map(t => ({
          'Tx Code': t.transaction_code,
          'Type': t.transaction_type,
          'Material': t.material_name,
          'Quantity': t.quantity,
          'Current Stock': sanitizeNumber(materials.find(m => m.id === t.material_id)?.current_stock),
          'Total Value (Birr)': formatCurrency(sanitizeNumber(t.unit_cost) * sanitizeNumber(t.quantity)),
          'Payment Method': t.transaction_type === 'STOCK_IN' ? sanitizeText(t.payment_method, 'Cash') : '—',
          'Recipient / Source': t.supplier_name ? `Supplier: ${sanitizeText(t.supplier_name, 'N/A')}` : sanitizeText(t.receiver_name, 'N/A'),
          'Issued By': sanitizeText(t.issued_by_name, 'Storekeeper'),
          'Date': new Date(t.transaction_date).toLocaleString()
        }));
      default:
        return [];
    }
  };

  const reportData = getReportData();

  const processedData = activeReport === 'TRANSACTION_HISTORY' 
    ? reportData.filter(row => {
        const matchesSearch = Object.values(row).some(val => String(val).toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesType = typeFilter === 'ALL' || row['Type'] === typeFilter;
        return matchesSearch && matchesType;
      })
    : reportData;

  const totalPages = Math.ceil(processedData.length / pageSize);
  const paginatedData = activeReport === 'TRANSACTION_HISTORY' 
    ? processedData.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : processedData;

  const typeColors = {
    'STOCK_IN': '#d1fae5',
    'STOCK_OUT': '#fee2e2',
    'RETURN': '#fef3c7',
    'ADJUSTMENT': '#dbeafe'
  };

  // Export to Excel handler
  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeReport);
    XLSX.writeFile(wb, `${activeReport}_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Export to PDF handler
  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Store Management System - ${reportTypes.find(r => r.id === activeReport)?.name}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

    if (reportData.length > 0) {
      const headers = Object.keys(reportData[0]);
      const body = reportData.map(row => Object.values(row));

      doc.autoTable({
        startY: 28,
        head: [headers],
        body: body,
        theme: 'striped',
        headStyles: { fillColor: [99, 102, 241] }
      });
    }

    doc.save(`${activeReport}_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Generate and export real-time store management reports to PDF &amp; Excel</p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={() => window.print()} title="Print current report">
            <Printer size={16} /> Print
          </button>
          <button className="btn btn-secondary" onClick={handleExportExcel}>
            <FileSpreadsheet size={16} color="#10b981" /> Export to Excel
          </button>
          <button className="btn btn-primary" onClick={handleExportPDF}>
            <FileText size={16} /> Download PDF
          </button>
        </div>
      </div>

      {/* Reports Selector Nav & Filters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 260px) minmax(0, 1fr)', gap: '20px' }}>
        {/* Left Side menu */}
        <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h4 style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
            Select Report Type
          </h4>
          {reportTypes.map(rep => (
            <button
              key={rep.id}
              onClick={() => { setActiveReport(rep.id); setCurrentPage(1); }}
              style={{
                textAlign: 'left',
                padding: '12px 14px',
                borderRadius: '8px',
                border: 'none',
                background: activeReport === rep.id ? 'var(--primary)' : 'transparent',
                color: activeReport === rep.id ? '#fff' : 'var(--text-primary)',
                fontWeight: activeReport === rep.id ? '700' : '500',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {rep.name}
            </button>
          ))}
        </div>

        {/* Right Side Table Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="glass-card" style={{ padding: '16px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <Filter size={18} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '14px', fontWeight: '600' }}>Filter:</span>
            <select 
              className="form-select" 
              style={{ width: '180px', minWidth: '0' }}
              value={selectedCategory} 
              onChange={e => setSelectedCategory(e.target.value)}
            >
              <option value="ALL">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>From:</span>
              <input
                type="date"
                className="form-input"
                style={{ width: '150px' }}
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                title="Start date"
              />
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>To:</span>
              <input
                type="date"
                className="form-input"
                style={{ width: '150px' }}
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                title="End date"
              />
              {(dateFrom || dateTo) && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setDateFrom(''); setDateTo(''); }}
                  title="Clear date filter"
                >
                  Clear
                </button>
              )}
            </div>
            {activeReport === 'TRANSACTION_HISTORY' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="Search..."
                    className="form-input"
                    style={{ width: '180px' }}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                  <select
                    className="form-select"
                    style={{ width: '150px' }}
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value)}
                  >
                    <option value="ALL">All Types</option>
                    <option value="STOCK_IN">Stock In</option>
                    <option value="STOCK_OUT">Stock Out</option>
                    <option value="RETURN">Return</option>
                    <option value="ADJUSTMENT">Adjustment</option>
                  </select>
                </div>
            )}
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {processedData.length} records
            </span>
          </div>

          <div className="table-container glass-card">
            {paginatedData.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No records available for this report view.
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    {Object.keys(paginatedData[0]).map((h, i) => (
                      <th key={i}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((row, idx) => (
                    <tr key={idx} style={{ backgroundColor: activeReport === 'TRANSACTION_HISTORY' ? (typeColors[row['Type']] || 'transparent') : 'transparent' }}>
                      {Object.values(row).map((val, cidx) => (
                        <td key={cidx}>{val}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {activeReport === 'TRANSACTION_HISTORY' && totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px', gap: '8px' }}>
                <button className="btn btn-secondary btn-sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}>Prev</button>
                <span style={{ fontSize: '13px' }}>Page {currentPage} of {totalPages}</span>
                <button className="btn btn-secondary btn-sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}>Next</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
