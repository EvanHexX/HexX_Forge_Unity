// src/main/services/generateAssetCatalogFromDataTsv.ts
// data.tsv를 HexX Forge UI용 asset_catalog.v2.json으로 변환하는 보조 스크립트입니다.

import fs from 'fs';
import path from 'path';

type DataTsvRow = {
  category: string;
  gender: string;
  type: string;
  texture_name: string;
  pathID: string;
  size: string;
  atlas_name: string;
  atlas_pathID: string;
  format: string;
};

const CATEGORY_MAP: Record<string, string> = {
  Outfit: 'outfit',
  Body: 'body',
  Face: 'face',
  Building: 'building',
};

const CATEGORY_LABEL: Record<string, string> = {
  outfit: '의상',
  body: '몸',
  face: '얼굴',
  building: '건물',
};

const GENDER_LABEL: Record<string, string> = {
  female: '여성',
  male: '남성',
};

function safeIdPart(value: string): string {
  return value.replace(/[^0-9A-Za-z가-힣]+/g, '_').replace(/^_+|_+$/g, '');
}

function parseTsv(content: string): DataTsvRow[] {
  const [headerLine, ...lines] = content.trim().split(/\r?\n/);
  const headers = headerLine.split('\t');

  return lines.filter(Boolean).map((line) => {
    const values = line.split('\t');
    return headers.reduce((acc, key, index) => {
      acc[key as keyof DataTsvRow] = values[index] ?? '';
      return acc;
    }, {} as DataTsvRow);
  });
}

export function generateAssetCatalogFromDataTsv(dataTsvPath: string, outputPath: string): void {
  const rows = parseTsv(fs.readFileSync(dataTsvPath, 'utf-8'));

  const items = rows.map((row) => {
    const category = CATEGORY_MAP[row.category] ?? row.category.toLowerCase();
    const [width, height] = row.size.split(',').map((value) => Number(value));
    const pathId = Number(row.pathID);
    const atlasPathId = Number(row.atlas_pathID);

    return {
      id: `${row.gender}_${category}_${safeIdPart(row.type)}_${row.texture_name}_${pathId}`,
      category,
      gender: row.gender,
      option2: row.type,
      label: `${row.type} ${GENDER_LABEL[row.gender] ?? row.gender} ${CATEGORY_LABEL[category] ?? category} 원본`,
      textureName: row.texture_name,
      pathId,
      size: [width, height] as [number, number],
      atlasName: row.atlas_name === 'None' ? null : row.atlas_name,
      atlasPathId,
      format: row.format,
      preview: '',
    };
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify({ schemaVersion: 2, source: 'data.tsv', items }, null, 2), 'utf-8');
}
