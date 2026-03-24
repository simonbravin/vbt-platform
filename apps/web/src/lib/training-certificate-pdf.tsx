import React from "react";
import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontFamily: "Helvetica",
  },
  title: {
    fontSize: 22,
    marginBottom: 24,
    textAlign: "center",
  },
  body: {
    fontSize: 12,
    lineHeight: 1.5,
    marginBottom: 12,
  },
  footer: {
    marginTop: 36,
    fontSize: 10,
    color: "#444",
    textAlign: "center",
  },
});

export type CertificatePdfProps = {
  title: string;
  participantName: string;
  organizationName: string;
  issuedAtLabel: string;
  statement: string;
  brandLine: string;
};

function CertificateDocument(props: CertificatePdfProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{props.title}</Text>
        <Text style={styles.body}>{props.statement}</Text>
        <Text style={styles.body}>
          {props.participantName}
          {"\n"}
          {props.organizationName}
        </Text>
        <Text style={styles.body}>{props.issuedAtLabel}</Text>
        <Text style={styles.footer}>{props.brandLine}</Text>
      </Page>
    </Document>
  );
}

function nodeStreamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

/** `pdf().toBuffer()` returns a Node readable stream (despite the name). */
export async function renderTrainingCertificatePdfBuffer(props: CertificatePdfProps): Promise<Buffer> {
  const instance = pdf(<CertificateDocument {...props} />);
  const stream = (await instance.toBuffer()) as unknown as NodeJS.ReadableStream;
  return nodeStreamToBuffer(stream);
}
