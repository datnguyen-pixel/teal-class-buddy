create index if not exists messages_sender_receiver_created_at_idx
on public.messages (sender_id, receiver_id, created_at desc);

create index if not exists messages_receiver_sender_created_at_idx
on public.messages (receiver_id, sender_id, created_at desc);