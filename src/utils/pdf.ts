import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { Project, CONCRETE_MIX_DESIGNS } from '../types';
import { calculateMixMaterials } from './calculations';
import { calculateConcreteCost, formatPrice } from './pricing';

const formatDateSafely = (dateString: string | undefined | null): string => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    return format(date, 'MMM d, yyyy');
  } catch {
    return 'N/A';
  }
};

export function generateProjectPDF(project: Project, selectedPsi: keyof typeof CONCRETE_MIX_DESIGNS) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  
  // Header
  doc.setFontSize(24);
  doc.text('Project Report', pageWidth / 2, 20, { align: 'center' });
  
  // Project Details
  doc.setFontSize(14);
  doc.text('Project Details', 14, 40);
  doc.setFontSize(12);
  doc.text(`Name: ${project.name || 'Untitled Project'}`, 14, 50);
  doc.text(`Created: ${formatDateSafely(project.createdAt)}`, 14, 60);
  if (project.description) {
    doc.text('Description:', 14, 70);
    const splitDescription = doc.splitTextToSize(project.description, pageWidth - 28);
    doc.text(splitDescription, 14, 80);
  }
  
  // Calculate total volume
  const calculations = project.calculations || [];
  const totalVolume = calculations.reduce((total, calc) => total + (calc.result?.volume || 0), 0);
  
  // Mix Design
  const mixDesign = calculateMixMaterials(totalVolume || 1, selectedPsi);
  doc.setFontSize(14);
  doc.text('Concrete Mix Design', 14, 110);
  doc.setFontSize(12);
  
  const mixDesignData = [
    ['Component', 'Amount', 'Unit'],
    ['Portland Cement', mixDesign.materials.cement.toFixed(2), 'yd³'],
    ['Fine Aggregate (Sand)', mixDesign.materials.sand.toFixed(2), 'yd³'],
    ['Coarse Aggregate', mixDesign.materials.aggregate.toFixed(2), 'yd³'],
    ['Water', mixDesign.materials.water.toString(), 'gal'],
  ];
  
  doc.autoTable({
    startY: 120,
    head: [mixDesignData[0]],
    body: mixDesignData.slice(1),
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
  });
  
  // Additional Mix Design Details
  const currentY = (doc as any).lastAutoTable.finalY + 10;
  doc.text(`Strength: ${selectedPsi} PSI`, 14, currentY);
  doc.text(`Water/Cement Ratio: ${mixDesign.waterCementRatio}`, 14, currentY + 10);
  doc.text(`Slump Range: ${mixDesign.slump.min}" - ${mixDesign.slump.max}"`, 14, currentY + 20);
  
  // Cost Estimate
  const costEstimate = calculateConcreteCost(totalVolume || 1, selectedPsi);
  doc.setFontSize(14);
  doc.text('Cost Estimate', 14, currentY + 40);
  
  const costData = [
    ['Item', 'Cost'],
    ['Concrete Cost', formatPrice(costEstimate.concreteCost)],
    ['Delivery Fees', formatPrice(costEstimate.deliveryFees.totalDeliveryFees)],
    ['Total Estimated Cost', formatPrice(costEstimate.totalCost)]
  ];
  
  doc.autoTable({
    startY: currentY + 50,
    head: [costData[0]],
    body: costData.slice(1),
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
  });

  // QC Records
  if (project.qcRecords && project.qcRecords.length > 0) {
    const qcY = (doc as any).lastAutoTable.finalY + 20;
    doc.setFontSize(14);
    doc.text('Quality Control Records', 14, qcY);

    const qcData = project.qcRecords.map(record => [
      format(new Date(record.date), 'MM/dd/yyyy'),
      `${record.temperature}°F`,
      `${record.humidity}%`,
      `${record.slump}"`,
      `${record.air_content}%`,
      record.cylindersMade.toString(),
      record.notes || ''
    ]);

    doc.autoTable({
      startY: qcY + 10,
      head: [['Date', 'Temp', 'Humidity', 'Slump', 'Air', 'Cylinders', 'Notes']],
      body: qcData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 20 },
        2: { cellWidth: 20 },
        3: { cellWidth: 20 },
        4: { cellWidth: 20 },
        5: { cellWidth: 20 },
        6: { cellWidth: 'auto' }
      }
    });
  }
  
  // Calculations Table
  if (calculations.length > 0) {
    const calculationsY = (doc as any).lastAutoTable.finalY + 20;
    doc.setFontSize(14);
    doc.text('Calculations', 14, calculationsY);
    
    const calculationsData = calculations.map(calc => [
      calc.type.charAt(0).toUpperCase() + calc.type.slice(1),
      formatDateSafely(calc.createdAt),
      `${calc.result?.volume || 0} yd³`,
      calc.result?.bags?.toString() || '0'
    ]);
    
    doc.autoTable({
      startY: calculationsY + 10,
      head: [['Type', 'Date', 'Volume', 'Bags Required']],
      body: calculationsData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
    });
  }
  
  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  doc.setFontSize(10);
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }
  
  // Save the PDF
  const fileName = project.name ? 
    `${project.name.toLowerCase().replace(/\s+/g, '-')}-report.pdf` : 
    'concrete-mix-report.pdf';
  doc.save(fileName);
}