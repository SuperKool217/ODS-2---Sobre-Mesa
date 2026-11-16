export async function addDonationEvent(client, donationId, type, description) {
  await client.query(
    'INSERT INTO eventos_donacion (donacion_id, tipo, descripcion) VALUES ($1, $2, $3)',
    [donationId, type, description]
  );
}
