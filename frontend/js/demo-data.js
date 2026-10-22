/* Fictional, session-only fixtures. Never written to the production data folder. */
(function () {
  'use strict';
  const categories = {
    test: { label: 'Test', code: 'TEST', color: '#d88d9e', icon: 'flask' },
    material: { label: 'Material', code: 'MATL', color: '#65b9a5', icon: 'layers' },
    design: { label: 'Design', code: 'DSGN', color: '#89a3dd', icon: 'compass' },
    measurement: { label: 'Measurement', code: 'MEAS', color: '#c6ae7b', icon: 'ruler' },
    manufacturing: { label: 'Manufacturing', code: 'MNFG', color: '#a898c7', icon: 'tool' }
  };
  const uuid = n => 'd3a01000-0000-4000-8000-' + n.toString(16).padStart(12, '0');
  const titles = {
    test: ['Performance and durability requirements', 'Pressure pulsation endurance', 'Corrosion resistance and salt spray', 'Filtration efficiency assessment', 'Thermal cycling procedure', 'Vibration and mechanical integrity', 'Leak tightness verification', 'Chemical compatibility testing', 'Contamination control procedure', 'Service life validation', 'Burst pressure assessment', 'Environmental conditioning'],
    material: ['Material selection and qualification', 'Elastomer sealing compounds', 'Metallic housing specifications', 'Polymer compatibility requirements', 'Surface treatment and coatings', 'Adhesive bonding materials', 'Filter media qualification', 'Chemical resistance of compounds', 'Recycled material qualification', 'Raw material traceability', 'Composite material specification', 'Protective coating requirements'],
    design: ['Design requirements for filtration systems', 'Interface and envelope requirements', 'Sealing system design', 'Assembly and tolerance specification', 'Housing design and wall thickness', 'Flow path optimization', 'Serviceability requirements', 'Connection and mounting design', 'Design verification requirements', 'Technical drawing conventions', 'Packaging and integration rules', 'Product identification and marking'],
    measurement: ['Dimensional inspection methods', 'Measurement system capability', 'Surface roughness measurement'],
    manufacturing: ['Assembly process requirements', 'Process qualification and control', 'Welding and joining processes']
  };
  function create() {
    let serial = 1, relationSerial = 5000;
    const standards = [], relations = [], entries = [], familyRoots = {};
    const products = [
      { id: 'PRODUCT-OIL-FILTER', name: 'Oil filter elements', group: 'Fluid Systems Liquid', subgroup: 'Oil filtration', description: 'Engineering references for oil filtration, sealing and product validation.', code: 'OFE' },
      { id: 'PRODUCT-FUEL-FILTER', name: 'Fuel filter modules', group: 'Fluid Systems Liquid', subgroup: 'Fuel filtration', description: 'Fuel filtration assemblies and their engineering dependencies.', code: 'FFM' },
      { id: 'PRODUCT-AIR-FILTER', name: 'Air filter elements', group: 'Fluid Systems Air', subgroup: 'Air filtration', description: 'Air filtration media, housings and performance requirements.', code: 'AFE' },
      { id: 'PRODUCT-SEPARATOR', name: 'Oil mist separators', group: 'Fluid Systems Air', subgroup: 'Crankcase ventilation', description: 'Separation systems and crankcase ventilation references.', code: 'OMS' }
    ];
    const addStandard = (category, index, override = {}) => {
      const meta = categories[category];
      const no = meta.code + '-' + String((category === 'design' ? 372 : category === 'test' ? 55 : category === 'material' ? 123 : 120) + index).padStart(3, '0');
      const record = {
        id: uuid(serial++),
        identification: { document_no: no, revision_no: index % 4 === 0 ? '12.0' : String(2 + index % 7) + '.0', title: titles[category][index % titles[category].length], previous_document_numbers: index % 9 === 0 ? ['MMS-' + (250 + index) + ' (EN)'] : [] },
        classification: { origin: 'internal', internal_category: category, organization: 'MAHLE', customer_id: null },
        applicability: { product_group_ids: ['FLUID-SYSTEMS-LIQUID'], product_subgroup_ids: ['OIL-FILTRATION', 'FUEL-FILTRATION'] },
        document_location: { online_url: '', file_path: '\\\\demo-server\\standards\\' + category + '\\' + no + '.pdf', file_name: no + '.pdf' },
        record_control: { status: 'active', created_at: '2026-10-21T09:00:00-03:00', updated_at: '2026-10-21T14:30:00-03:00' }, preview_only: true, ...override
      };
      standards.push(record); return record;
    };
    const link = (source, target, strength = 2) => {
      if (relations.some(r => r.source_standard_id === source.id && r.target_standard_id === target.id)) return;
      relations.push({ id: uuid(relationSerial++), source_standard_id: source.id, target_standard_id: target.id, strength_level: strength });
    };
    for (const category of ['test', 'material', 'design']) {
      const pool = Array.from({ length: 31 }, (_, i) => addStandard(category, i)); familyRoots[category] = pool[0];
      let next = 1, frontier = [pool[0]], depth = 0;
      while (next < pool.length) {
        const following = [];
        for (let i = 0; i < frontier.length && next < pool.length; i++) {
          const count = depth === 0 ? 3 : 2 + (i % 3 === 0 ? 1 : 0);
          for (let j = 0; j < count && next < pool.length; j++) { const child = pool[next++]; link(frontier[i], child, j === 0 ? 3 : j === 1 ? 2 : 1); following.push(child); }
        }
        frontier = following; depth++;
      }
    }
    const meas = Array.from({ length: 3 }, (_, i) => addStandard('measurement', i));
    const mnfg = Array.from({ length: 3 }, (_, i) => addStandard('manufacturing', i));
    const specs = [['ISO 9227', 'Corrosion tests in artificial atmospheres', 'ISO'], ['ISO 16889', 'Multi-pass method for filtration performance', 'ISO'], ['ISO 16232', 'Cleanliness of components and systems', 'ISO'], ['ASTM D471', 'Rubber property — effect of liquids', 'ASTM'], ['DIN 7168', 'General tolerances for linear dimensions', 'DIN']];
    const international = specs.map(([no, title, org], i) => addStandard('test', i, { identification: { document_no: no, revision_no: '2024', title, previous_document_numbers: [] }, classification: { origin: 'international', internal_category: null, organization: org, customer_id: null }, document_location: { online_url: '', file_path: null, file_name: null } }));
    const byCode = code => standards.find(s => s.identification.document_no === code);
    link(byCode('TEST-057'), international[0], 3); link(byCode('MATL-125'), international[3], 2);
    link(byCode('DSGN-374'), international[4], 1); link(byCode('TEST-059'), international[1], 3);
    link(byCode('MATL-128'), international[0], 1); link(byCode('DSGN-375'), meas[0], 2);
    link(byCode('TEST-060'), international[2], 2); link(byCode('DSGN-376'), mnfg[0], 1);
    link(byCode('DSGN-384'), byCode('TEST-057'), 2);
    link(byCode('MATL-140'), byCode('MATL-124'), 1);
    for (const product of products) {
      ['test', 'material', 'design'].forEach((category, i) => entries.push({ id: uuid(relationSerial++), product_id: product.id, standard_id: familyRoots[category].id, placement: 'radial_branch', branch: category, strength_level: 3, display_order: i + 1 }));
      [...meas, ...mnfg].forEach((standard, i) => entries.push({ id: uuid(relationSerial++), product_id: product.id, standard_id: standard.id, placement: 'island', island: standard.classification.internal_category, strength_level: i % 3 + 1, display_order: i + 1 }));
    }
    return { schema_version: '1.0', preview_only: true, products, standards, relations: { schema_version: '1.0', product_standard_relations: entries, standard_standard_relations: relations }, taxonomy: { product_groups: [{ id: 'FLUID-SYSTEMS-LIQUID', name: 'Fluid Systems Liquid' }, { id: 'FLUID-SYSTEMS-AIR', name: 'Fluid Systems Air' }], product_subgroups: [{ id: 'OIL-FILTRATION', name: 'Oil filtration' }, { id: 'FUEL-FILTRATION', name: 'Fuel filtration' }, { id: 'AIR-FILTRATION', name: 'Air filtration' }] } };
  }
  window.FractalDemo = { create, categories };
})();
