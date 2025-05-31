import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { BookOpen, AlignCenterVertical as Certificate, ShieldCheck, ClipboardList } from 'lucide-react';

const ExternalResources: React.FC = () => {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/resources')}
            icon={<ArrowLeft size={20} />}
            className="text-white hover:text-blue-200 mb-4"
          >
            Back to Resources
          </Button>
          <h1 className="text-3xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
            External Resources
          </h1>
          <p className="text-white text-lg drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] mt-2">
            Industry standards, certifications, and educational resources
          </p>
        </div>

        <div className="space-y-8">
          {/* Standards & Regulations */}
          <section>
            <h2 className="text-2xl font-semibold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] mb-4">
              Standards &amp; Regulations
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="p-6 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm">
                <div className="flex items-start space-x-4">
                  <ShieldCheck className="h-6 w-6 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">ACI (American Concrete Institute)</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                      Industry consensus standards for concrete design & construction.
                    </p>
                    <Button
                      as="a"
                      href="https://www.concrete.org"
                      target="_blank"
                      rel="noopener noreferrer"
                      size="sm"
                      variant="outline"
                    >
                      Visit ACI.org
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm">
                <div className="flex items-start space-x-4">
                  <ClipboardList className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">OSHA (Occupational Safety &amp; Health Administration)</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                      Regulations for safe handling and placement of concrete.
                    </p>
                    <Button
                      as="a"
                      href="https://www.osha.gov"
                      target="_blank"
                      rel="noopener noreferrer"
                      size="sm"
                      variant="outline"
                    >
                      Visit OSHA.gov
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm">
                <div className="flex items-start space-x-4">
                  <ShieldCheck className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">ASTM International</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                      Material testing standards for cement, aggregates, and concrete.
                    </p>
                    <Button
                      as="a"
                      href="https://www.astm.org/CEMENT/"
                      target="_blank"
                      rel="noopener noreferrer"
                      size="sm"
                      variant="outline"
                    >
                      Visit ASTM.org
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm">
                <div className="flex items-start space-x-4">
                  <ClipboardList className="h-6 w-6 text-teal-600 dark:text-teal-400 flex-shrink-0" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">PCI (Precast/Prestressed Concrete Institute)</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                      Design and fabrication standards for precast concrete structures.
                    </p>
                    <Button
                      as="a"
                      href="https://www.pci.org"
                      target="_blank"
                      rel="noopener noreferrer"
                      size="sm"
                      variant="outline"
                    >
                      Visit PCI.org
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm">
                <div className="flex items-start space-x-4">
                  <BookOpen className="h-6 w-6 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">NRMCA (National Ready Mixed Concrete Assoc.)</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                      Ready-mix concrete guidelines, sustainability & environmental best practices.
                    </p>
                    <Button
                      as="a"
                      href="https://www.nrmca.org"
                      target="_blank"
                      rel="noopener noreferrer"
                      size="sm"
                      variant="outline"
                    >
                      Visit NRMCA.org
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm">
                <div className="flex items-start space-x-4">
                  <ShieldCheck className="h-6 w-6 text-gray-700 dark:text-gray-300 flex-shrink-0" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">AASHTO (American Assoc. of State Highway & Transportation Officials)</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                      Transportation-related concrete design & testing standards.
                    </p>
                    <Button
                      as="a"
                      href="https://www.transportation.org"
                      target="_blank"
                      rel="noopener noreferrer"
                      size="sm"
                      variant="outline"
                    >
                      Visit Transportation.org
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </section>

          {/* Education & Certification */}
          <section>
            <h2 className="text-2xl font-semibold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] mb-4">
              Education &amp; Certification
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="p-6 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm">
                <div className="flex items-start space-x-4">
                  <Certificate className="h-6 w-6 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">ACI Certified Concrete Field Testing Technician</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                      Hands-on training and certification in field testing of concrete properties.
                    </p>
                    <Button
                      as="a"
                      href="https://www.concrete.org/education/certification/concretefieldtestingtechnician.aspx"
                      target="_blank"
                      rel="noopener noreferrer"
                      size="sm"
                      variant="outline"
                    >
                      Learn More
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm">
                <div className="flex items-start space-x-4">
                  <Certificate className="h-6 w-6 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">ACI Concrete Construction Inspector</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                      Certification for inspectors overseeing proper concrete installation.
                    </p>
                    <Button
                      as="a"
                      href="https://www.concrete.org/education/certification/concreteconstructioninspector.aspx"
                      target="_blank"
                      rel="noopener noreferrer"
                      size="sm"
                      variant="outline"
                    >
                      Learn More
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm">
                <div className="flex items-start space-x-4">
                  <Certificate className="h-6 w-6 text-blue-800 dark:text-blue-600 flex-shrink-0" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">ASTM Concrete Testing Technician</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                      Certification in ASTM test methods for concrete and cement.
                    </p>
                    <Button
                      as="a"
                      href="https://www.concrete.org/certification/certificationprograms.aspx?m=details&pgm=Field%20Concrete%20Testing&cert=Concrete%20Field%20Testing%20Technician%E2%80%94Grade%20I"
                      target="_blank"
                      rel="noopener noreferrer"
                      size="sm"
                      variant="outline"
                    >
                      Learn More
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm">
                <div className="flex items-start space-x-4">
                  <Certificate className="h-6 w-6 text-green-800 dark:text-green-600 flex-shrink-0" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">NRMCA Sustainability Certification</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                      Courses on sustainable concrete practices and LEED integration.
                    </p>
                    <Button
                      as="a"
                      href="https://www.nrmca.org/education"
                      target="_blank"
                      rel="noopener noreferrer"
                      size="sm"
                      variant="outline"
                    >
                      Learn More
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm">
                <div className="flex items-start space-x-4">
                  <Certificate className="h-6 w-6 text-indigo-800 dark:text-indigo-600 flex-shrink-0" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Coursera: Concrete Materials & Structures</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                      University‐led online courses covering concrete design and durability.
                    </p>
                    <Button
                      as="a"
                      href="https://www.coursera.org/search?query=concrete"
                      target="_blank"
                      rel="noopener noreferrer"
                      size="sm"
                      variant="outline"
                    >
                      Explore Courses
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm">
                <div className="flex items-start space-x-4">
                  <Certificate className="h-6 w-6 text-red-800 dark:text-red-600 flex-shrink-0" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">LinkedIn Learning: Construction Tech</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                      Video courses on concrete technology, project management, and safety.
                    </p>
                    <Button
                      as="a"
                      href="https://www.linkedin.com/learning/search?keywords=concrete"
                      target="_blank"
                      rel="noopener noreferrer"
                      size="sm"
                      variant="outline"
                    >
                      Browse Lynda.com
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm">
                <div className="flex items-start space-x-4">
                  <Certificate className="h-6 w-6 text-purple-800 dark:text-purple-600 flex-shrink-0" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">NCCER Certification</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                      Recognized craft and safety credentials for concrete work.
                    </p>
                    <Button
                      as="a"
                      href="https://www.nccer.org/certifications"
                      target="_blank"
                      rel="noopener noreferrer"
                      size="sm"
                      variant="outline"
                    >
                      Learn More
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </section>
        </div>
      </div>
    </motion.div>
  );
};

export default ExternalResources;