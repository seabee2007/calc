import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
// Register the plugin with jsPDF once at module load
// @ts-ignore – plugin type defs expect two params in older versions
autoTable(jsPDF);
import { format } from 'date-fns';
import { Project, CONCRETE_MIX_DESIGNS } from '../types';
import { calculateMixMaterials } from './calculations';
import { calculateConcreteCost, formatPrice } from './pricing';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

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

// Helper function to handle iOS file saving and sharing
async function saveAndShareOnIOS(pdfBlob: Blob, filename: string): Promise<boolean> {
  try {
    // Convert blob to base64
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        resolve(base64);  // Keep the full base64 string including data URI
      };
      reader.onerror = reject;
      reader.readAsDataURL(pdfBlob);
    });

    // Try direct sharing first
    try {
      await Share.share({
        title: filename,
        text: 'Your PDF is ready',
        url: base64Data,
        dialogTitle: 'Save PDF'
      });
      return true;
    } catch (shareError) {
      console.log('Direct sharing failed, trying file system:', shareError);
    }

    // If direct sharing fails, try file system
    try {
      // Ensure we have a clean base64 string
      const cleanBase64 = base64Data.split(',')[1] || base64Data;
      
      // Save to Documents directory instead of Cache
      const safePath = `${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      
      await Filesystem.writeFile({
        path: safePath,
        data: cleanBase64,
        directory: Directory.Documents,  // Use Documents instead of Cache
        recursive: true
      });

      const fileUri = await Filesystem.getUri({
        path: safePath,
        directory: Directory.Documents
      });

      // Share the file
      await Share.share({
        title: filename,
        text: 'Your PDF is ready',
        url: fileUri.uri,
        dialogTitle: 'Save PDF'
      });

      // Clean up
      try {
        await Filesystem.deleteFile({
          path: safePath,
          directory: Directory.Documents
        });
      } catch (cleanupError) {
        console.warn('Failed to cleanup temporary file:', cleanupError);
      }

      return true;
    } catch (fsError) {
      console.error('File system operations failed:', fsError);
      
      // Final fallback: try data URL sharing
      try {
        const dataUrl = `data:application/pdf;base64,${base64Data.split(',')[1]}`;
        await Share.share({
          title: filename,
          text: 'Your PDF is ready',
          url: dataUrl,
          dialogTitle: 'Save PDF'
        });
        return true;
      } catch (dataUrlError) {
        console.error('Data URL sharing failed:', dataUrlError);
        throw dataUrlError;
      }
    }
  } catch (error) {
    console.error('All iOS sharing methods failed:', error);
    return false;
  }
}

// Helper function to safely download PDF
async function downloadPDF(doc: jsPDF, filename: string): Promise<boolean> {
  try {
    const pdfBlob = doc.output('blob');

    // Check if running on iOS
    if (Capacitor.getPlatform() === 'ios') {
      return await saveAndShareOnIOS(pdfBlob, filename);
    }

    // For web platform
    const nativeFS = 'showSaveFilePicker' in window &&
                    typeof window.showSaveFilePicker === 'function';
    
    if (nativeFS) {
      try {
        // @ts-ignore - Modern API not yet in TypeScript
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: 'PDF Document',
            accept: { 'application/pdf': ['.pdf'] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(pdfBlob);
        await writable.close();
        return true;
      } catch (err) {
        if (!(err instanceof Error && err.name === 'AbortError')) {
          console.warn('File System Access API failed, falling back to blob download:', err);
        }
      }
    }

    // Fallback to blob download for web
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error('Error downloading PDF:', error);
    // Last resort: try direct save
    try {
      doc.save(filename);
      return true;
    } catch (finalError) {
      console.error('All PDF download methods failed:', finalError);
      alert('Failed to download PDF. Please try again.');
      return false;
    }
  }
}

// Function to generate Mix Specification PDF
export async function generateMixSpecPDF(
  psi: string,
  airContent: [number, number],
  waterCementRatio: number,
  admixtures: string[],
  filename?: string
): Promise<boolean> {
  console.log('Generating Mix Spec PDF with data:', { psi, airContent, waterCementRatio, admixtures });
  
  try {
    const doc = new jsPDF();
    // autoTable already registered globally
    const pageWidth = doc.internal.pageSize.width;
    
    // Header
    doc.setFontSize(24);
    doc.text('Concrete Mix Specification', pageWidth / 2, 20, { align: 'center' });
    
    // Date
    doc.setFontSize(12);
    doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy')}`, pageWidth / 2, 30, { align: 'center' });
    
    // Main specifications
    doc.setFontSize(16);
    doc.text('Mix Design Requirements', 14, 50);
    
    doc.setFontSize(12);
    doc.text(`Design Strength: ${psi} PSI`, 14, 65);
    doc.text(`Air Content Range: ${airContent[0]}-${airContent[1]}%`, 14, 75);
    doc.text(`Maximum W/C Ratio: ${waterCementRatio.toFixed(2)}`, 14, 85);
    
    // Admixtures table
    doc.setFontSize(14);
    doc.text('Required Admixtures', 14, 105);
    
    const admixtureData = admixtures.map((admix, index) => [
      (index + 1).toString(),
      admix
    ]);
    
    try {
      doc.autoTable({
        startY: 115,
        head: [['#', 'Admixture Requirement']],
        body: admixtureData,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] },
        columnStyles: {
          0: { cellWidth: 20 },
          1: { cellWidth: 'auto' }
        }
      });
    } catch (tableError) {
      console.error('Error creating autoTable:', tableError);
      // Fallback to simple text if table fails
      let yPos = 115;
      admixtureData.forEach(([num, text]) => {
        doc.text(`${num}. ${text}`, 14, yPos);
        yPos += 10;
      });
    }
    
    // References
    const currentY = doc.lastAutoTable.finalY + 20;
    doc.setFontSize(14);
    doc.text('Code References', 14, currentY);
    
    const references = [
      'ACI 318-19 Section 5 (Durability Requirements)',
      'ACI 211.2-98 (Standard Practice for Selecting Proportions for Structural Lightweight Concrete)',
      'ACI 308R-16 (Guide to Curing Concrete)',
      'ASTM C494 (Standard Specification for Chemical Admixtures for Concrete)',
      'ASTM C260 (Standard Specification for Air-Entraining Admixtures for Concrete)'
    ];
    
    doc.setFontSize(10);
    references.forEach((ref, index) => {
      doc.text(`• ${ref}`, 14, currentY + 15 + (index * 8));
    });
    
    // Footer
    const finalY = currentY + 15 + (references.length * 8) + 20;
    doc.setFontSize(10);
    doc.text('This specification is generated for reference purposes only.', pageWidth / 2, finalY, { align: 'center' });
    doc.text('Consult with a qualified engineer for final mix design approval.', pageWidth / 2, finalY + 8, { align: 'center' });
    
    // Save the PDF
    const pdfFilename = filename || `mix-specification-${psi}psi-${Date.now()}.pdf`;
    return await downloadPDF(doc, pdfFilename);
  } catch (error) {
    console.error('Error generating Mix Spec PDF:', error);
    alert('Failed to generate PDF. Please try again or contact support.');
    return false;
  }
}

// Function to generate proposal PDF from HTML content
export async function generateProposalPDF(htmlContent: string, title: string, filename?: string): Promise<void> {
  try {
    // Create a temporary div to render the HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.width = '210mm'; // A4 width
    tempDiv.style.background = 'white';
    tempDiv.style.padding = '20px';
    tempDiv.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    tempDiv.style.fontSize = '14px';
    tempDiv.style.lineHeight = '1.6';
    tempDiv.style.color = '#374151';
    
    document.body.appendChild(tempDiv);
    
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(tempDiv, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: true,
        logging: false,
        width: 800,
        height: tempDiv.scrollHeight
      });
      
      document.body.removeChild(tempDiv);
      
      // Create PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      // autoTable already registered globally
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth - 20; // 10mm margin on each side
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 10; // 10mm top margin
      
      // Add first page
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= (pdfHeight - 20); // Account for margins
      
      // Add additional pages if needed
      while (heightLeft > 0) {
        position = heightLeft - imgHeight + 10;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= (pdfHeight - 20);
      }
      
      const pdfFilename = filename || `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
      await downloadPDF(pdf, pdfFilename);
    } catch (error) {
      console.error('Error generating proposal PDF:', error);
      document.body.removeChild(tempDiv);
      generateSimpleProposalPDF(title, filename);
    }
  } catch (error) {
    console.error('Error in generateProposalPDF:', error);
    generateSimpleProposalPDF(title, filename);
  }
}

// Fallback simple PDF generator
function generateSimpleProposalPDF(title: string, filename?: string) {
  console.log('Using fallback simple PDF generation');
  
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    
    // Header
    doc.setFontSize(20);
    doc.text(title, pageWidth / 2, 30, { align: 'center' });
    
    // Date
    doc.setFontSize(12);
    doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy')}`, pageWidth / 2, 45, { align: 'center' });
    
    // Message
    doc.setFontSize(11);
    const message = [
      'PDF Generation Notice:',
      '',
      'This is a simplified PDF version of your proposal.',
      'For the best formatted version, please use the Print/PDF button',
      'in the preview window, which will open your browser\'s print dialog',
      'where you can save as PDF with full formatting.',
      '',
      'Alternatively, you can:',
      '• Use the Print/PDF button for full formatting',
      '• Email the proposal directly from the app',
      '• Copy content from the preview for other uses',
      '',
      'Thank you for using our proposal generator!'
    ];
    
    let yPos = 65;
    message.forEach(line => {
      if (line === '') {
        yPos += 6;
      } else if (line === 'PDF Generation Notice:') {
        doc.setFontSize(14);
        doc.text(line, pageWidth / 2, yPos, { align: 'center' });
        doc.setFontSize(11);
        yPos += 12;
      } else {
        doc.text(line, pageWidth / 2, yPos, { align: 'center' });
        yPos += 8;
      }
    });
    
    // Save the PDF
    const pdfFilename = filename || `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_simple.pdf`;
    
    // For iOS/Capacitor compatibility, use blob download instead of direct save
    try {
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.download = pdfFilename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      console.log('Simple PDF generated successfully:', pdfFilename);
    } catch (saveError) {
      console.error('Blob download failed, trying direct save:', saveError);
      doc.save(pdfFilename);
    }
    
    // Show user message
    alert('PDF downloaded! For best formatting, use the Print/PDF button in the preview.');
    
  } catch (error) {
    console.error('Simple PDF generation failed:', error);
    alert('PDF generation failed. Please try using the Print/PDF button in the preview instead.');
  }
}

export function generateProjectPDF(project: Project, selectedPsi: keyof typeof CONCRETE_MIX_DESIGNS) {
  const doc = new jsPDF();
  // autoTable already registered globally
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
  
  (doc as any).autoTable({
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
  
  (doc as any).autoTable({
    startY: currentY + 50,
    head: [costData[0]],
    body: costData.slice(1),
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
  });

  // QC Records - only if they exist in the project
  const projectWithQC = project as any;
  if (projectWithQC.qcRecords && projectWithQC.qcRecords.length > 0) {
    const qcY = (doc as any).lastAutoTable.finalY + 20;
    doc.setFontSize(14);
    doc.text('Quality Control Records', 14, qcY);

    const qcData = projectWithQC.qcRecords.map((record: any) => [
      format(new Date(record.date), 'MM/dd/yyyy'),
      `${record.temperature}°F`,
      `${record.humidity}%`,
      `${record.slump}"`,
      `${record.air_content}%`,
      record.cylindersMade.toString(),
      record.notes || ''
    ]);

    (doc as any).autoTable({
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
    
    (doc as any).autoTable({
      startY: calculationsY + 10,
      head: [['Type', 'Date', 'Volume', 'Bags Required']],
      body: calculationsData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
    });
  }
  
  // Footer
  const pageCount = (doc.internal as any).getNumberOfPages();
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
    
  // For iOS/Capacitor compatibility, use blob download instead of direct save
  try {
    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    console.log('Project PDF generated successfully:', fileName);
  } catch (saveError) {
    console.error('Blob download failed, trying direct save:', saveError);
  doc.save(fileName);
  }
}

// Type augmentation for jsPDF to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}